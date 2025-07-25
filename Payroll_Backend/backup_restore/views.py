from django.http import HttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes, parser_classes
from django.core.management import call_command
from django.shortcuts import render
import io
import os
from django.conf import settings
from datetime import datetime
from rest_framework.parsers import MultiPartParser, FormParser
from django.views.decorators.http import require_POST


@require_POST
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def backup_view(request):
    if request.user.role != 'admin':
        return HttpResponse("Forbidden", status=403)

    buffer = io.StringIO()
    call_command('dumpdata', stdout=buffer)
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"backup_{timestamp}.json"
    response = HttpResponse(buffer.getvalue(), content_type='application/json')
    response['Content-Disposition'] = f'attachment; filename={filename}'
    return response

@require_POST
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def restore_view(request):
    user = request.user
    if not user.is_authenticated or getattr(user, 'role', None) != 'admin':
        return HttpResponse("Forbidden", status=403)

    uploaded_file = request.FILES.get('backup_file')
    if not uploaded_file:
        return HttpResponse("No file uploaded", status=400)

    try:
        # Ensure MEDIA_ROOT exists
        if not os.path.exists(settings.MEDIA_ROOT):
            os.makedirs(settings.MEDIA_ROOT)
            
        # Save to temporary path
        # Use a more robust temporary filename to avoid conflicts, e.g., using a timestamp
        temp_filename = f"temp_restore_{datetime.now().strftime('%Y%m%d%H%M%S%f')}.json"
        temp_path = os.path.join(settings.MEDIA_ROOT, temp_filename)
        
        with open(temp_path, 'wb+') as temp_file:
            for chunk in uploaded_file.chunks():
                temp_file.write(chunk)

        # Load the data using loaddata
        call_command('loaddata', temp_path)

    except Exception as e:
        # Log the actual exception on the server side for better debugging
        print(f"Restore failed: {str(e)}")
        return HttpResponse(f"Restore failed: {str(e)}", status=500)
    finally: # Ensure cleanup even if loaddata fails
        # Clean up
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
    return HttpResponse("Restore completed successfully!", status=200)
