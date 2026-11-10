FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Collect admin/API static files at build time (served by whitenoise).
RUN DJANGO_SECRET_KEY=build-only DATABASE_URL=sqlite:////tmp/build.sqlite3 \
    python manage.py collectstatic --noinput --settings=config.settings.development

RUN adduser --disabled-password --gecos "" uos \
    && chown -R uos:uos /app

USER uos

EXPOSE 8000

CMD ["sh", "-c", "python manage.py migrate --noinput && exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3"]
