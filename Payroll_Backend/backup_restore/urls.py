from .views import backup_view, restore_view
from django.urls import path

urlpatterns = [
    path('backup/', backup_view, name='backup'),
    path('restore/', restore_view, name='restore'),
]
