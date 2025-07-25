from rest_framework import viewsets
from .models import Payroll
from .serializers import PayrollSerializer
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from leavedetails.models import LeaveDetails, NoAttendanceRecordsError
from employee.models import Employee
from leavedetails.serializers import LeaveDetailsSerializer
from datetime import datetime
from django.db import transaction
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.platypus import Table, TableStyle, Paragraph, SimpleDocTemplate, Spacer, Image
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from django.http import FileResponse
from rest_framework.permissions import IsAuthenticated
import io
import os
import shutil
from reportlab.lib.units import mm
from django.conf import settings
from django.core.mail import EmailMessage
import base64
from rest_framework.decorators import api_view, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser
from decimal import Decimal
import logging
from django.views.decorators.http import require_GET

class PayrollViewSet(viewsets.ModelViewSet):
    queryset = Payroll.objects.all()
    serializer_class = PayrollSerializer

payroll_logger = logging.getLogger('payroll_operations')
class GeneratePayrollAPIView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated]
    def post(self, request):
        payroll_logger.info("Received request to generate/update payroll.")
        
        employee_id = request.data.get('employee_id')
        month_str = request.data.get('month')  # e.g., '2025-05'
        perform_category = request.data.get('perform_category')
        reimbursement = Decimal(request.data.get('reimbursement', 0))
        reimbursement_proof = request.FILES.get('reimbursement_proof')

        # Get the user who performed the action
        performed_by_user = request.user.id if request.user.is_authenticated else "Anonymous"


        if not all([employee_id, month_str, perform_category]):
            return Response({"error": "Missing required fields."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                month = datetime.strptime(month_str, '%Y-%m').date().replace(day=1)
                employee = Employee.objects.get(id=employee_id)

                # Create or update LeaveDetails
                leave_record, _ = LeaveDetails.objects.get_or_create(employee=employee, month=month)
                leave_record.save()  # Triggers auto computation

                # Create or update Payroll
                payroll, created = Payroll.objects.get_or_create(employee=employee, month=month)

                # Store old values for detailed logging if updating
                old_reimbursement = payroll.reimbursement
                old_reimbursement_proof_name = os.path.basename(payroll.reimbursement_proof.name) if payroll.reimbursement_proof else None

                payroll.perform_category = perform_category
                payroll.reimbursement = reimbursement
                if reimbursement > 0:
                    # If reimbursement is positive, attempt to set or clear proof based on upload
                    if reimbursement_proof:
                        if payroll.reimbursement_proof:
                            if payroll.reimbursement_proof.file != reimbursement_proof:
                                payroll.reimbursement_proof.delete(save=False) # Delete old file
                        payroll.reimbursement_proof = reimbursement_proof
                    else:
                        if payroll.reimbursement_proof:
                            payroll.reimbursement_proof.delete(save=False) # Delete old file
                        payroll.reimbursement_proof = None
                else: 
                    if payroll.reimbursement_proof:
                        payroll.reimbursement_proof.delete(save=False) # delete=False prevents saving DB here
                    payroll.reimbursement_proof = None

                if created:
                    log_message_parts = [
                        f"Payroll GENERATED for employee: {employee.name} (ID: {employee_id}) ",
                        f"for month: {month_str} by {performed_by_user}. ",
                        f"Initial perform_category: {perform_category}, reimbursement: {reimbursement}."
                    ]
                    if payroll.reimbursement_proof:
                        log_message_parts.append(f" Reimbursement proof: '{payroll.reimbursement_proof.name}'.")
                    else:
                        log_message_parts.append(" No reimbursement proof expected/provided (reimbursement is zero).")

                    payroll_logger.info("".join(log_message_parts))
                else:
                    log_message_parts = [
                        f"Payroll UPDATED for employee: {employee_id} - {employee.name} "
                        f"for month: {month_str} by {performed_by_user}."
                    ]
                    
                    if old_reimbursement != reimbursement:
                        log_message_parts.append(
                            f" Reimbursement changed from '{old_reimbursement}' to '{reimbursement}'."
                        )
                    
                    new_reimbursement_proof_name = payroll.reimbursement_proof.name if payroll.reimbursement_proof else None
                    if old_reimbursement_proof_name and not new_reimbursement_proof_name:
                        log_message_parts.append(f" Reimbursement proof '{old_reimbursement_proof_name}' removed.")
                    elif not old_reimbursement_proof_name and new_reimbursement_proof_name:
                        log_message_parts.append(f" Reimbursement proof '{new_reimbursement_proof_name}' added.")
                    elif old_reimbursement_proof_name and new_reimbursement_proof_name and old_reimbursement_proof_name != new_reimbursement_proof_name:
                        log_message_parts.append(f" Reimbursement proof changed from '{old_reimbursement_proof_name}' to '{new_reimbursement_proof_name}'.")

                    payroll_logger.info("".join(log_message_parts))


                payroll.save()  # Triggers payroll computation
                payroll_logger.info(f"Payroll computation triggered and saved for employee {employee_id} for month {month_str}.\n")

                return Response({
                    "leave_details": LeaveDetailsSerializer(leave_record).data,
                    "payroll": PayrollSerializer(payroll).data
                }, status=status.HTTP_201_CREATED)

        except Employee.DoesNotExist:
            return Response({"error": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)
        except ValueError:
            return Response({"error": "Invalid month format. Use YYYY-MM."}, status=status.HTTP_400_BAD_REQUEST)
        except NoAttendanceRecordsError as e:
            # Catch the custom exception and return a specific error message
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            # Catch any other unexpected errors
            return Response({"error": f"An unexpected error occurred: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        

class GeneratePayslipPDFView(APIView):

    def get(self, request):
        employee_id = request.query_params.get('employee_id')
        month_str = request.query_params.get('month')  # 'YYYY-MM'

        try:
            month_date = datetime.strptime(month_str, "%Y-%m").date().replace(day=1)
            payroll = Payroll.objects.get(employee__id=employee_id, month=month_date)
            leave = LeaveDetails.objects.get(employee__id=employee_id, month=month_date)
        except Payroll.DoesNotExist:
            return Response({"error": "Payroll not found"}, status=404)
        except LeaveDetails.DoesNotExist:
            return Response({"error": "Leave details not found"}, status=404)

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4,
                                rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)

        styles = getSampleStyleSheet()
        normal = styles["Normal"]
        bold = ParagraphStyle("Bold", parent=normal, fontName="Helvetica-Bold", fontSize=10)
        company_info_style = ParagraphStyle(
            name='CompanyInfo',
            parent=normal,
            leading=12, # Line spacing
            alignment=1
        )
        center_aligned_bold = ParagraphStyle(name='CenterAlignedBold', parent=bold, alignment=1, fontSize=12, leading=16)
        
        table_text_style = ParagraphStyle(name='TableText', parent=normal, fontSize=9)
        table_label_style = ParagraphStyle(name='TableLabel', parent=bold, fontSize=9)

        fee_header_style = ParagraphStyle(name='FeeHeader', parent=bold, fontSize=10, alignment=1)
        fee_net_style = ParagraphStyle(name='FeeNet', parent=bold, fontSize=10, alignment=0) 
        fee_label_style = ParagraphStyle(name='FeeLabel', parent=normal, fontSize=9, alignment=0)
        fee_value_style = ParagraphStyle(name='FeeValue', parent=normal, fontSize=9, alignment=2)
        fee_total_style = ParagraphStyle(name='FeeTotal', parent=bold, fontSize=9, alignment=1)

        gen_style = ParagraphStyle(name='Gen', parent=normal, fontSize=9, alignment=1)
        
        leave_heading_style = ParagraphStyle(name='LeaveHeading', parent=bold, fontSize=10, alignment=1)
        leave_table_header_style = ParagraphStyle(name='LeaveTableHeader', parent=bold, fontSize=9, alignment=1)
        leave_table_value_style = ParagraphStyle(name='LeaveTableValue', parent=normal, fontSize=9, alignment=1)
        leave_balance_style = ParagraphStyle(name='LeaveBalance', parent=bold, fontSize=9, alignment=1) 

        
        elements = []

        company_name = Paragraph(
            '<para alignment="center"><font size="14" face="Helvetica-Bold">Jivass Technologies</font></para>',
            company_info_style
        )

        company_details = Paragraph(
            '<font size="8" face="Helvetica-Bold">F1, Ashwamedha, No 121, Velachery Main Road, Chennai – 600032,<br/>'
            'Phone: 9840694738 Email: contact@jivass.com</font>',
            company_info_style
        )

        company_info_cell = [company_name, Spacer(1, 8), company_details]

        # Header with Logo + Company Info + Title
        logo_path = os.path.join(settings.BASE_DIR, "static/images/jivass_technologies_logo.jpeg")
        header_table = Table([
            [
                Image(logo_path, width=10 * mm, height=10 * mm),
                company_info_cell,
                Paragraph(f"<b>Consultant Pay Slip</b><br/> {payroll.month.strftime('%B %Y')}", center_aligned_bold)
            ]
        ], colWidths=[40, 320, 140])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (0, -1), 'TOP'),
            ('VALIGN', (1, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (0, 0), (0, 0), 'LEFT'), # Logo left align
            ('ALIGN', (1, 0), (1, 0), 'CENTER'), # Company info left align within its cell
            ('BOX', (0, 0), (1, 0), 1, colors.black),
            ('ALIGN', (2, 0), (2, 0), 'CENTER'), # Pay Slip title right align
            ('BOX', (2, 0), (2, 0), 1, colors.black), # Border around Pay Slip cell
            ('TOPPADDING', (1,0), (2,0), 10),
            ('TOPPADDING', (0,0), (0,0), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ]))
        elements.append(header_table)
       
        # Employee Info Table
        emp = payroll.employee
        emp_info_data = [
            [Paragraph('Consultant ID:', table_label_style), Paragraph(str(emp.id), table_label_style), '', Paragraph('Date of Joining:', table_label_style), Paragraph(emp.date_joined.strftime('%d/%m/%Y'), table_label_style)],
            [Paragraph('Name:', table_label_style), Paragraph(emp.name, table_text_style), '', '', ''],
            [Paragraph('Designation:', table_label_style), Paragraph(emp.designation or "N/A", table_text_style), '', '', ''],
            [Paragraph('PAN:', table_label_style), Paragraph(emp.pan_no or "N/A", table_text_style), '', '', ''],
            [Paragraph('Mobile:', table_label_style), Paragraph(emp.phone_no or "N/A", table_text_style), '', '', ''],
            [Paragraph('Email:', table_label_style), Paragraph(emp.email or "N/A", table_text_style), '', '', '']
        ]

        emp_info_col_widths = [88, 194, 20, 78, 120] # Adjusted to sum to page width (~500 points)

        emp_info_table = Table(emp_info_data, colWidths=emp_info_col_widths)
        emp_info_table.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 1, colors.black), # Main box border
            #('GRID', (0,0), (-1,-1), 0.25, colors.black), # Internal grid lines, thinner
            ('LINEBELOW', (0, 0), (-1, 0), 0.35, colors.lightgrey),  
            ('LINEBELOW', (0, 1), (-1, 1), 0.35, colors.lightgrey),
            ('LINEBELOW', (0, 2), (-1, 2), 0.35, colors.lightgrey),
            ('LINEBELOW', (0, 3), (-1, 3), 0.35, colors.lightgrey),
            ('LINEBELOW', (0, 4), (-1, 4), 0.35, colors.lightgrey),
            ('SPAN', (1, 1), (-1, 1)), # Name spans across remaining columns
            ('SPAN', (1, 2), (-1, 2)), # Designation spans
            ('SPAN', (1, 3), (-1, 3)), # PAN spans
            ('SPAN', (1, 4), (-1, 4)), # Mobile spans
            ('SPAN', (1, 5), (-1, 5)), # Email spans
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0,0), (-1,-1), 5),
            ('LEFTPADDING', (4,0), (4,0), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 5),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,4), (-1,4), 3),
            ('BOTTOMPADDING', (0,5), (-1,5), 5),
        ]))
        elements.append(emp_info_table)
        elements.append(Spacer(1, 15))

        
        # Consultant Fee Details
        fee_table_data = [
            # Header row (Row 0)
            [Paragraph('Consultant Fee Details', fee_header_style), '', '', '', '', ''],
            # (Row 1)
            ['', '', '', '','', Paragraph('Total', fee_total_style)],
            #(Row 2)
            [Paragraph(f'Month : <b>{payroll.month.strftime("%B")}</b>', fee_label_style), Paragraph('Base Pay Earned :', fee_label_style) ,Paragraph(f"{payroll.base_pay_earned:,.2f}", fee_value_style), '','',''],
            # (Row 3)
            [Paragraph(f'Working Days : {leave.working_days}', fee_label_style),Paragraph('Variable Pay Earned :', fee_label_style) ,Paragraph(f"{payroll.perform_comp_payable:,.2f}", fee_value_style), '','',''],
            # (Row 4)
            [Paragraph(f'Days Worked : {leave.days_worked}', fee_label_style), Paragraph('Fee Earned :', fee_label_style) ,Paragraph(f"{payroll.fee_earned:,.2f}", fee_value_style), Paragraph('TDS Deducted :', fee_label_style),Paragraph(f"{payroll.tds:,.2f}", fee_value_style) ,Paragraph(f"{(payroll.fee_earned - payroll.tds):,.2f}", fee_value_style)],
            # (Row 5)
            [Paragraph(f'Absent Days : {leave.absent_days}', fee_label_style), Paragraph('Reimbursement :', fee_label_style), Paragraph(f"{payroll.reimbursement:,.2f}", fee_value_style), '', '', Paragraph(f"{payroll.reimbursement:,.2f}", fee_value_style)],
            # (Row 6)
            [Paragraph('Total', fee_total_style), '', Paragraph(f"{(payroll.fee_earned + payroll.reimbursement):,.2f}", fee_value_style), '', Paragraph(f"{payroll.tds:,.2f}", fee_value_style),Paragraph(f"{(payroll.fee_earned - payroll.tds + payroll.reimbursement):,.2f}", fee_value_style)],
            # Net Fee Earned row (Row 7)
            [Paragraph('Net Fee Earned :', fee_header_style),Paragraph(f"{payroll.net_fee_earned}", fee_net_style), '', Paragraph(f"Generated On : {payroll.generated_on.strftime('%d/%m/%Y')},{payroll.generated_time.strftime('%H:%M:%S')}", gen_style), '', ''],
        ]

        fee_col_widths = [120, 100, 60, 85, 55, 80] # Adjusted to sum to page width (~500 points)

        fee_table = Table(fee_table_data, colWidths=fee_col_widths)
        fee_table.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 1, colors.black),
            #('GRID', (0, 0), (-1, -1), 0.25, colors.black),
            ('LINEAFTER', (0, 0), (0, 6), 0.75, colors.black),
            ('LINEAFTER', (2, 0), (2, 6), 0.75, colors.black),
            ('LINEAFTER', (4, 0), (4, 6), 0.75, colors.black),
            ('LINEBELOW', (0, 0), (-1, 0), 1, colors.black),
            ('LINEBELOW', (0, 1), (-1, 1), 0.75, colors.black),
            ('LINEBELOW', (0, 5), (-1, 6), 0.75, colors.black),
            ('LINEBELOW', (0, 2), (-1, 4), 0.35, colors.lightgrey),
            ('SPAN', (0, 0), (-1, 0)), # 'Consultant Fee Details'
            ('SPAN', (3, -1), (5, -1)),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,7), (-1,7), 5),
            ('BOTTOMPADDING', (0,0), (-1,6), 3),
            ('BOTTOMPADDING', (0,7), (-1,7), 5),
            ('LEFTPADDING', (0,0), (-1,-1), 5),
            ('LEFTPADDING', (2,0), (2,-1), 0),
            ('LEFTPADDING', (4,0), (4,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 5),
            ('RIGHTPADDING', (1,0), (1,-1), 0),
            ('RIGHTPADDING', (3,0), (3,-1), 0),
        ]))
        elements.append(fee_table)
        elements.append(Spacer(1, 15))

        
        leave_table_data = [
            [Paragraph('Leave Details', leave_heading_style), '', '', ''],
            [Paragraph('Paid Leaves', leave_table_header_style), Paragraph('Sick Leaves', leave_table_header_style), Paragraph('Unpaid Leaves', leave_table_header_style), Paragraph('Total leaves Taken', leave_table_header_style)],
            [Paragraph(str(leave.paid_leaves), leave_table_value_style), Paragraph(str(leave.sick_leaves), leave_table_value_style), Paragraph(str(leave.unpaid_leaves), leave_table_value_style), Paragraph(str(leave.total_leaves_taken), leave_table_value_style)],
            [Paragraph(f"Leave Balance : {leave.total_paid_leaves_left} Days", leave_balance_style), '', Paragraph(f"Sick Leave Balance : {leave.total_sick_leaves_left} Days", leave_balance_style), '']
        ]

        leave_table = Table(leave_table_data, colWidths=[85, 85, 85, 105]) 
        leave_table.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 1, colors.black),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('LINEBELOW', (0, 0), (-1, 0), 1, colors.black),
            ('SPAN', (0, 0), (-1, 0)),
            ('SPAN', (0, 3), (1, 3)), # Span for Leave Balance
            ('SPAN', (2, 3), (3, 3)), # Span for Sick Leave Balance
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0,0), (-1,-1), 5),
            ('RIGHTPADDING', (0,0), (-1,-1), 5),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ('BOTTOMPADDING', (0,-1), (-1,-1), 5),
        ]))
        #elements.append(leave_table)
        wrapper_table = Table([[leave_table]], colWidths=[500])  # match outer width
        wrapper_table.setStyle(TableStyle([
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(wrapper_table)

        doc.build(elements)
        buffer.seek(0)

        generated_date_for_filename = payroll.generated_on.strftime('%Y-%m-%d')
        generated_time_for_filename = payroll.generated_time.strftime('%H-%M-%S')
        saved_filename = f"payslip_{employee_id}_{month_str}_gen-{generated_date_for_filename},{generated_time_for_filename}.pdf"

        # Create the full path for the file
        payslip_folder = settings.PAYSLIP_STORAGE_DIR # Use the path from settings
        payslip_archive_folder = settings.PAYSLIP_ARCHIVE_DIR

        os.makedirs(payslip_folder, exist_ok=True) # Create folder if it doesn't exist
        os.makedirs(payslip_archive_folder, exist_ok=True)

        payslip_prefix_to_match = f"payslip_{employee_id}_{month_str}_"
        moved_payslips_count = 0

        # Iterate through files in the current payslip storage directory
        for existing_filename in os.listdir(payslip_folder):
            if (existing_filename.startswith(payslip_prefix_to_match) and existing_filename.endswith('.pdf') and existing_filename != saved_filename):
                old_file_path = os.path.join(payslip_folder, existing_filename)
                archive_file_path = os.path.join(payslip_archive_folder, existing_filename)
                
                try:
                    # Move the old payslip to the archive folder
                    shutil.move(old_file_path, archive_file_path)
                    moved_payslips_count += 1
                    print(f"Moved old payslip '{existing_filename}' to archive.")
                except Exception as e:
                    print(f"Error moving old payslip '{existing_filename}' to archive: {e}")
                    # Log the error but continue to try saving the new one
        
        # Prepare message about moved payslips
        archive_message = ""
        if moved_payslips_count > 0:
            archive_message = f" {moved_payslips_count} old payslip(s) moved to archive."
        
        file_path = os.path.join(payslip_folder, saved_filename)

        try:
            with open(file_path, 'wb') as f:
                f.write(buffer.getvalue()) # Write the PDF content to the file
            print(f"Payslip saved to: {file_path}") # Log for confirmation
            file_saved_message = "Payslip saved to payslips folder." + archive_message
        except IOError as e:
            print(f"Error saving payslip to file: {e}")
            file_saved_message = f"Error saving payslip to folder: {str(e)}" + archive_message

        filename = f"payslip_{employee_id}_{month_str}.pdf"

        # Compose Email
        subject = f"Payslip for {payroll.month.strftime('%B %Y')}"
        body = f"Dear {payroll.employee.name},\n\nPlease find the attached payslip for {payroll.month.strftime('%B %Y')}.\n\nBest Regards,\nJivass Technologies"
        to_email = payroll.employee.email

        email_message = "" # Initialize email message
        email_status_code = status.HTTP_200_OK

        if not to_email:
            email_message = "Email could not be sent (missing employee email)."
        else:
            try:
                email = EmailMessage(subject, body, to=[to_email])
                buffer.seek(0)
                email.attach(filename, buffer.read(), 'application/pdf') 
                email.send()
                email_message = "Payslip emailed successfully."
            except Exception as e:
                email_message = f"Payslip generated, but failed to email: {str(e)}"
                email_status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
                # Log the error for debugging
                print(f"Error sending email for employee {employee_id}, month {month_str}: {e}")

        buffer.seek(0)

        pdf_binary_data = buffer.getvalue()
        pdf_base64_string = base64.b64encode(pdf_binary_data).decode('utf-8')

        final_message = f"Payslip generated. {file_saved_message}. {email_message}"

        return Response({
            "message": final_message,
            "pdf_data": pdf_base64_string,
            "saved_path": file_path # Include the saved path in the response
        }, status=email_status_code if email_status_code != status.HTTP_200_OK else status.HTTP_200_OK)


class DownloadPayslipPDFView(APIView):

    def get(self, request):
        employee_id = request.query_params.get('employee_id')
        month_str = request.query_params.get('month')  # 'YYYY-MM'

        try:
            month_date = datetime.strptime(month_str, "%Y-%m").date().replace(day=1)
            payroll = Payroll.objects.get(employee__id=employee_id, month=month_date)
            leave = LeaveDetails.objects.get(employee__id=employee_id, month=month_date)
        except Payroll.DoesNotExist:
            return Response({"error": "Payroll not found"}, status=404)
        except LeaveDetails.DoesNotExist:
            return Response({"error": "Leave details not found"}, status=404)

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4,
                                rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)

        styles = getSampleStyleSheet()
        normal = styles["Normal"]
        bold = ParagraphStyle("Bold", parent=normal, fontName="Helvetica-Bold", fontSize=10)
        company_info_style = ParagraphStyle(
            name='CompanyInfo',
            parent=normal,
            leading=12, # Line spacing
            alignment=1
        )
        center_aligned_bold = ParagraphStyle(name='CenterAlignedBold', parent=bold, alignment=1, fontSize=12, leading=16)
        
        table_text_style = ParagraphStyle(name='TableText', parent=normal, fontSize=9)
        table_label_style = ParagraphStyle(name='TableLabel', parent=bold, fontSize=9)

        fee_header_style = ParagraphStyle(name='FeeHeader', parent=bold, fontSize=10, alignment=1)
        fee_net_style = ParagraphStyle(name='FeeNet', parent=bold, fontSize=10, alignment=0) 
        fee_label_style = ParagraphStyle(name='FeeLabel', parent=normal, fontSize=9, alignment=0)
        fee_value_style = ParagraphStyle(name='FeeValue', parent=normal, fontSize=9, alignment=2)
        fee_total_style = ParagraphStyle(name='FeeTotal', parent=bold, fontSize=9, alignment=1)

        gen_style = ParagraphStyle(name='Gen', parent=normal, fontSize=9, alignment=1)

        leave_heading_style = ParagraphStyle(name='LeaveHeading', parent=bold, fontSize=10, alignment=1)
        leave_table_header_style = ParagraphStyle(name='LeaveTableHeader', parent=bold, fontSize=9, alignment=1)
        leave_table_value_style = ParagraphStyle(name='LeaveTableValue', parent=normal, fontSize=9, alignment=1)
        leave_balance_style = ParagraphStyle(name='LeaveBalance', parent=bold, fontSize=9, alignment=1) 

        
        elements = []

        company_name = Paragraph(
            '<para alignment="center"><font size="14" face="Helvetica-Bold">Jivass Technologies</font></para>',
            company_info_style
        )

        company_details = Paragraph(
            '<font size="8" face="Helvetica-Bold">F1, Ashwamedha, No 121, Velachery Main Road, Chennai – 600032,<br/>'
            'Phone: 9840694738 Email: contact@jivass.com</font>',
            company_info_style
        )

        company_info_cell = [company_name, Spacer(1, 8), company_details]

        # Header with Logo + Company Info + Title
        logo_path = os.path.join(settings.BASE_DIR, "static/images/jivass_technologies_logo.jpeg")
        header_table = Table([
            [
                Image(logo_path, width=10 * mm, height=10 * mm),
                company_info_cell,
                Paragraph(f"<b>Consultant Pay Slip</b><br/> {payroll.month.strftime('%B %Y')}", center_aligned_bold)
            ]
        ], colWidths=[40, 320, 140])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (0, -1), 'TOP'),
            ('VALIGN', (1, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (0, 0), (0, 0), 'LEFT'), # Logo left align
            ('ALIGN', (1, 0), (1, 0), 'CENTER'), # Company info left align within its cell
            ('BOX', (0, 0), (1, 0), 1, colors.black),
            ('ALIGN', (2, 0), (2, 0), 'CENTER'), # Pay Slip title right align
            ('BOX', (2, 0), (2, 0), 1, colors.black), # Border around Pay Slip cell
            ('TOPPADDING', (1,0), (2,0), 10),
            ('TOPPADDING', (0,0), (0,0), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ]))
        elements.append(header_table)
       
        # Employee Info Table
        emp = payroll.employee
        emp_info_data = [
            [Paragraph('Consultant ID:', table_label_style), Paragraph(str(emp.id), table_label_style), '', Paragraph('Date of Joining:', table_label_style), Paragraph(emp.date_joined.strftime('%d/%m/%Y'), table_label_style)],
            [Paragraph('Name:', table_label_style), Paragraph(emp.name, table_text_style), '', '', ''],
            [Paragraph('Designation:', table_label_style), Paragraph(emp.designation or "N/A", table_text_style), '', '', ''],
            [Paragraph('PAN:', table_label_style), Paragraph(emp.pan_no or "N/A", table_text_style), '', '', ''],
            [Paragraph('Mobile:', table_label_style), Paragraph(emp.phone_no or "N/A", table_text_style), '', '', ''],
            [Paragraph('Email:', table_label_style), Paragraph(emp.email or "N/A", table_text_style), '', '', '']
        ]

        emp_info_col_widths = [88, 194, 20, 78, 120] # Adjusted to sum to page width (~500 points)

        emp_info_table = Table(emp_info_data, colWidths=emp_info_col_widths)
        emp_info_table.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 1, colors.black), # Main box border
            #('GRID', (0,0), (-1,-1), 0.25, colors.black), # Internal grid lines, thinner
            ('LINEBELOW', (0, 0), (-1, 0), 0.35, colors.lightgrey),  
            ('LINEBELOW', (0, 1), (-1, 1), 0.35, colors.lightgrey),
            ('LINEBELOW', (0, 2), (-1, 2), 0.35, colors.lightgrey),
            ('LINEBELOW', (0, 3), (-1, 3), 0.35, colors.lightgrey),
            ('LINEBELOW', (0, 4), (-1, 4), 0.35, colors.lightgrey),
            ('SPAN', (1, 1), (-1, 1)), # Name spans across remaining columns
            ('SPAN', (1, 2), (-1, 2)), # Designation spans
            ('SPAN', (1, 3), (-1, 3)), # PAN spans
            ('SPAN', (1, 4), (-1, 4)), # Mobile spans
            ('SPAN', (1, 5), (-1, 5)), # Email spans
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0,0), (-1,-1), 5),
            ('LEFTPADDING', (4,0), (4,0), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 5),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,4), (-1,4), 3),
            ('BOTTOMPADDING', (0,5), (-1,5), 5),
        ]))
        elements.append(emp_info_table)
        elements.append(Spacer(1, 15))

        
        # Consultant Fee Details
        fee_table_data = [
            # Header row (Row 0)
            [Paragraph('Consultant Fee Details', fee_header_style), '', '', '', '', ''],
            # (Row 1)
            ['', '', '', '','', Paragraph('Total', fee_total_style)],
            #(Row 2)
            [Paragraph(f'Month : <b>{payroll.month.strftime("%B")}</b>', fee_label_style), Paragraph('Base Pay Earned :', fee_label_style) ,Paragraph(f"{payroll.base_pay_earned:,.2f}", fee_value_style), '','',''],
            # (Row 3)
            [Paragraph(f'Working Days : {leave.working_days}', fee_label_style),Paragraph('Variable Pay Earned :', fee_label_style) ,Paragraph(f"{payroll.perform_comp_payable:,.2f}", fee_value_style), '','',''],
            # (Row 4)
            [Paragraph(f'Days Worked : {leave.days_worked}', fee_label_style), Paragraph('Fee Earned :', fee_label_style) ,Paragraph(f"{payroll.fee_earned:,.2f}", fee_value_style), Paragraph('TDS Deducted :', fee_label_style),Paragraph(f"{payroll.tds:,.2f}", fee_value_style) ,Paragraph(f"{(payroll.fee_earned - payroll.tds):,.2f}", fee_value_style)],
            # (Row 5)
            [Paragraph(f'Absent Days : {leave.absent_days}', fee_label_style), Paragraph('Reimbursement :', fee_label_style), Paragraph(f"{payroll.reimbursement:,.2f}", fee_value_style), '', '', Paragraph(f"{payroll.reimbursement:,.2f}", fee_value_style)],
            # (Row 6)
            [Paragraph('Total', fee_total_style), '', Paragraph(f"{(payroll.fee_earned + payroll.reimbursement):,.2f}", fee_value_style), '', Paragraph(f"{payroll.tds:,.2f}", fee_value_style),Paragraph(f"{(payroll.fee_earned - payroll.tds + payroll.reimbursement):,.2f}", fee_value_style)],
            # Net Fee Earned row (Row 7)
            [Paragraph('Net Fee Earned :', fee_header_style),Paragraph(f"{payroll.net_fee_earned}", fee_net_style), '', Paragraph(f"Generated On : {payroll.generated_on.strftime('%d/%m/%Y')},{payroll.generated_time.strftime('%H:%M:%S')}", gen_style), '', ''],
        ]

        fee_col_widths = [120, 100, 60, 85, 55, 80] # Adjusted to sum to page width (~500 points)

        fee_table = Table(fee_table_data, colWidths=fee_col_widths)
        fee_table.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 1, colors.black),
            #('GRID', (0, 0), (-1, -1), 0.25, colors.black),
            ('LINEAFTER', (0, 0), (0, 6), 0.75, colors.black),
            ('LINEAFTER', (2, 0), (2, 6), 0.75, colors.black),
            ('LINEAFTER', (4, 0), (4, 6), 0.75, colors.black),
            ('LINEBELOW', (0, 0), (-1, 0), 1, colors.black),
            ('LINEBELOW', (0, 1), (-1, 1), 0.75, colors.black),
            ('LINEBELOW', (0, 5), (-1, 6), 0.75, colors.black),
            ('LINEBELOW', (0, 2), (-1, 4), 0.35, colors.lightgrey),
            ('SPAN', (0, 0), (-1, 0)), # 'Consultant Fee Details'
            ('SPAN', (3, -1), (5, -1)),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,7), (-1,7), 5),
            ('BOTTOMPADDING', (0,0), (-1,6), 3),
            ('BOTTOMPADDING', (0,7), (-1,7), 5),
            ('LEFTPADDING', (0,0), (-1,-1), 5),
            ('LEFTPADDING', (2,0), (2,-1), 0),
            ('LEFTPADDING', (4,0), (4,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 5),
            ('RIGHTPADDING', (1,0), (1,-1), 0),
            ('RIGHTPADDING', (3,0), (3,-1), 0),
        ]))
        elements.append(fee_table)
        elements.append(Spacer(1, 15))

        
        leave_table_data = [
            [Paragraph('Leave Details', leave_heading_style), '', '', ''],
            [Paragraph('Paid Leaves', leave_table_header_style), Paragraph('Sick Leaves', leave_table_header_style), Paragraph('Unpaid Leaves', leave_table_header_style), Paragraph('Total leaves Taken', leave_table_header_style)],
            [Paragraph(str(leave.paid_leaves), leave_table_value_style), Paragraph(str(leave.sick_leaves), leave_table_value_style), Paragraph(str(leave.unpaid_leaves), leave_table_value_style), Paragraph(str(leave.total_leaves_taken), leave_table_value_style)],
            [Paragraph(f"Leave Balance : {leave.total_paid_leaves_left} Days", leave_balance_style), '', Paragraph(f"Sick Leave Balance : {leave.total_sick_leaves_left} Days", leave_balance_style), '']
        ]

        leave_table = Table(leave_table_data, colWidths=[85, 85, 85, 105]) 
        leave_table.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 1, colors.black),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('LINEBELOW', (0, 0), (-1, 0), 1, colors.black),
            ('SPAN', (0, 0), (-1, 0)),
            ('SPAN', (0, 3), (1, 3)), # Span for Leave Balance
            ('SPAN', (2, 3), (3, 3)), # Span for Sick Leave Balance
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0,0), (-1,-1), 5),
            ('RIGHTPADDING', (0,0), (-1,-1), 5),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ('BOTTOMPADDING', (0,-1), (-1,-1), 5),
        ]))
        #elements.append(leave_table)
        wrapper_table = Table([[leave_table]], colWidths=[500])  # match outer width
        wrapper_table.setStyle(TableStyle([
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(wrapper_table)

        doc.build(elements)
        buffer.seek(0)
        
        filename = f"payslip_{employee_id}_{month_str}.pdf"

        return FileResponse(buffer, as_attachment=True, filename=filename, content_type='application/pdf')
    

class MyPayslipsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee = request.user  
        payslips = Payroll.objects.filter(employee=employee).order_by('-month')
        data = [
            {
                "month": p.month.strftime('%Y-%m'),
                "net_fee_earned": p.net_fee_earned,
                "employee_id": p.employee.id
            }
            for p in payslips
        ]
        return Response(data)

@require_GET    
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def monthly_employees_view(request):
    month_str = request.GET.get('month')
    if not month_str:
        return Response({"error": "Month required (YYYY-MM)"}, status=400)

    try:
        month_date = datetime.strptime(month_str, "%Y-%m").date().replace(day=1)
    except ValueError:
        return Response({"error": "Invalid format, use YYYY-MM"}, status=400)

    employees_for_month = []
    payroll_exists = False
    existing_payroll_data = []

    # Fetch all employees relevant to the selected month
    all_relevant_employees = Employee.objects.filter(
        # Only include employees who joined on or before the selected month
        # This is more efficient than iterating all employees in Python
        date_joined__year__lte=month_date.year,
        date_joined__month__lte=month_date.month
    ).order_by('id')


    # Fetch all payroll records for the given month in one query
    # and select_related to get employee data efficiently
    payroll_records_for_month = Payroll.objects.filter(
        month=month_date
    ).select_related('employee')

    # Determine if payroll already exists for this month
    if payroll_records_for_month.exists():
        payroll_exists = True
        # Serialize existing payroll data
        existing_payroll_data = PayrollSerializer(payroll_records_for_month, many=True, context={'request': request}).data

    # Create a dictionary for quick lookup of existing payroll by employee ID
    payroll_by_employee_id = {str(p.employee.id): p for p in payroll_records_for_month}


    for emp in all_relevant_employees:
        emp_data = {
            "id": emp.id,
            "name": emp.name,
            "role": emp.role,
            "pay_structure": emp.pay_structure,
            # Default values if no payroll exists for this employee this month
            "perform_category": "",
            "reimbursement": 0.0,
            "reimbursement_proof": None, # Default to None
        }

        # If payroll exists for this employee for this month, override defaults
        if str(emp.id) in payroll_by_employee_id:
            payroll_instance = payroll_by_employee_id[str(emp.id)]

            serialized_payroll = PayrollSerializer(payroll_instance, context={'request': request}).data

            emp_data["perform_category"] = serialized_payroll.get("perform_category", "")
            emp_data["reimbursement"] = float(serialized_payroll.get("reimbursement", 0))
            # Get the absolute URL from the serialized output
            emp_data["reimbursement_proof"] = serialized_payroll.get("reimbursement_proof", None)
        employees_for_month.append(emp_data)


    return Response({
        "employees": employees_for_month,
        "payroll_exists": payroll_exists,
        "payroll_data": existing_payroll_data # Optionally, you can send this too, though the merged 'employees' might be enough
    }, status=200)
