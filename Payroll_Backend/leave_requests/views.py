from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import LeaveRequest
from .serializers import LeaveRequestSerializer

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_leave_request(request):
    """ Allows employees and HR to submit leave requests. """
    serializer = LeaveRequestSerializer(data=request.data)

    if serializer.is_valid():
        serializer.save(requester=request.user, status="pending")  # ✅ Ensure requester is assigned and status starts as pending
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    print("Validation Errors:", serializer.errors)  # 🔍 Debugging step
    return Response({"errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_leave_requests_for_approval(request):
    """ HR views all employee requests (pending & processed), Admin views all HR requests (pending & processed). """
    user = request.user

    if user.role == "hr":
        leave_requests = LeaveRequest.objects.filter(requester__role="employee").select_related("requester")
    elif user.role == "admin":
        leave_requests = LeaveRequest.objects.filter(requester__role="hr").select_related("requester")
    else:
        return Response({"error": "Unauthorized access."}, status=status.HTTP_403_FORBIDDEN)

    serializer = LeaveRequestSerializer(leave_requests, many=True)
    return Response(serializer.data)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_leave_request_status(request, request_id):
    """ Allows HR/Admin to approve or reject leave requests based on role. """
    user = request.user
    new_status = request.data.get("status")  # ✅ Renaming `status` to `new_status`

    if new_status not in ["approved", "rejected"]:
        return Response({"error": "Invalid status update."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        leave_req = LeaveRequest.objects.get(id=request_id, status="pending")  # ✅ Ensure request is still pending
    except LeaveRequest.DoesNotExist:
        return Response({"error": "Leave request not found or already processed."}, status=status.HTTP_404_NOT_FOUND)

    # ✅ Ensure correct permissions for status change
    if (user.role == "hr" and leave_req.requester.role == "employee") or (user.role == "admin" and leave_req.requester.role == "hr"):
        leave_req.status = new_status  # ✅ Uses renamed variable to avoid `status` conflict
        leave_req.save()
        return Response({"message": f"Leave request {new_status}."}, status=status.HTTP_200_OK)

    return Response({"error": "Unauthorized action."}, status=status.HTTP_403_FORBIDDEN)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_requests(request):
    """ Allows users to view their submitted leave requests """
    user = request.user

    if user.role == "hr":
        leave_requests = LeaveRequest.objects.filter(requester=user).order_by("-created_at")  # ✅ HR sees all their requests (sorted by latest)
    elif user.role == "admin":
        leave_requests = LeaveRequest.objects.filter(requester__role="hr").order_by("-created_at")  # ✅ Admin sees all HR requests (any status)
    else:
        leave_requests = LeaveRequest.objects.filter(requester=user).order_by("-created_at")  # ✅ Employees see their own requests

    serializer = LeaveRequestSerializer(leave_requests, many=True)
    return Response(serializer.data)