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
from reportlab.lib.units import mm
from django.conf import settings
from django.core.mail import EmailMessage

class PayrollViewSet(viewsets.ModelViewSet):
    queryset = Payroll.objects.all()
    serializer_class = PayrollSerializer


class GeneratePayrollAPIView(APIView):
    def post(self, request):
        employee_id = request.data.get('employee_id')
        month_str = request.data.get('month')  # e.g., '2025-05'
        perform_category = request.data.get('perform_category')
        reimbursement = request.data.get('reimbursement', 0)

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
                payroll.perform_category = perform_category
                payroll.reimbursement = reimbursement
                payroll.save()  # Triggers payroll computation

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
            [Paragraph(f'Month : <b>{payroll.month.strftime("%B")}</b>', fee_label_style), '', '', '', '', ''],
            # (Row 3)
            [Paragraph(f'Working Days : {leave.working_days}', fee_label_style),Paragraph('Fee Earned :', fee_label_style) ,Paragraph(f"{payroll.fee_earned:,.2f}", fee_value_style), Paragraph('TDS Deducted :', fee_label_style),Paragraph(f"{payroll.tds:,.2f}", fee_value_style) ,Paragraph(f"{(payroll.fee_earned - payroll.tds):,.2f}", fee_value_style)],
            # (Row 4)
            [Paragraph(f'Days Worked : {leave.days_worked}', fee_label_style), Paragraph('Reimbursement :', fee_label_style), Paragraph(f"{payroll.reimbursement:,.2f}", fee_value_style), '', '', Paragraph(f"{payroll.reimbursement:,.2f}", fee_value_style)],
            # (Row 5)
            [Paragraph(f'Absent Days : {leave.absent_days}', fee_label_style), '', '', '', '', ''],
            # (Row 6)
            [Paragraph('Total', fee_total_style), '', Paragraph(f"{(payroll.fee_earned + payroll.reimbursement):,.2f}", fee_value_style), '', Paragraph(f"{payroll.tds:,.2f}", fee_value_style),Paragraph(f"{(payroll.fee_earned - payroll.tds + payroll.reimbursement):,.2f}", fee_value_style)],
            # Net Fee Earned row (Row 7)
            [Paragraph('Net Fee Earned :', fee_header_style),Paragraph(f"{payroll.net_fee_earned}", fee_net_style), '', '', '', ''],
        ]

        fee_col_widths = [120, 85, 60, 85, 60, 90] # Adjusted to sum to page width (~500 points)

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

        # Compose Email
        subject = f"Payslip for {payroll.month.strftime('%B %Y')}"
        body = f"Dear {payroll.employee.name},\n\nPlease find the attached payslip for {payroll.month.strftime('%B %Y')}.\n\nBest Regards,\nJivass Technologies"
        to_email = payroll.employee.email

        if not to_email:
            return Response({"message": "Payslip generated, but email could not be sent (missing employee email).", "pdf_data": buffer.getvalue().decode('latin-1')}, status=status.HTTP_200_OK)
        
        email = EmailMessage(subject, body, to=[to_email])
        filename = f"payslip_{employee_id}_{month_str}.pdf"
        email.attach(filename, buffer.read(), 'application/pdf')
        email.send()

        buffer.seek(0)

        return Response({"message": "Payslip generated and emailed successfully.", "pdf_data": buffer.getvalue().decode('latin-1')}, status=status.HTTP_200_OK)
    

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
            [Paragraph(f'Month : <b>{payroll.month.strftime("%B")}</b>', fee_label_style), '', '', '', '', ''],
            # (Row 3)
            [Paragraph(f'Working Days : {leave.working_days}', fee_label_style),Paragraph('Fee Earned :', fee_label_style) ,Paragraph(f"{payroll.fee_earned:,.2f}", fee_value_style), Paragraph('TDS Deducted :', fee_label_style),Paragraph(f"{payroll.tds:,.2f}", fee_value_style) ,Paragraph(f"{(payroll.fee_earned - payroll.tds):,.2f}", fee_value_style)],
            # (Row 4)
            [Paragraph(f'Days Worked : {leave.days_worked}', fee_label_style), Paragraph('Reimbursement :', fee_label_style), Paragraph(f"{payroll.reimbursement:,.2f}", fee_value_style), '', '', Paragraph(f"{payroll.reimbursement:,.2f}", fee_value_style)],
            # (Row 5)
            [Paragraph(f'Absent Days : {leave.absent_days}', fee_label_style), '', '', '', '', ''],
            # (Row 6)
            [Paragraph('Total', fee_total_style), '', Paragraph(f"{(payroll.fee_earned + payroll.reimbursement):,.2f}", fee_value_style), '', Paragraph(f"{payroll.tds:,.2f}", fee_value_style),Paragraph(f"{(payroll.fee_earned - payroll.tds + payroll.reimbursement):,.2f}", fee_value_style)],
            # Net Fee Earned row (Row 7)
            [Paragraph('Net Fee Earned :', fee_header_style),Paragraph(f"{payroll.net_fee_earned}", fee_net_style), '', '', '', ''],
        ]

        fee_col_widths = [120, 85, 60, 85, 60, 90] # Adjusted to sum to page width (~500 points)

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