from django.contrib import admin

from .models import PlannerState


@admin.register(PlannerState)
class PlannerStateAdmin(admin.ModelAdmin):
    list_display = ("user", "version", "updated_at")
    readonly_fields = ("version", "created_at", "updated_at")
