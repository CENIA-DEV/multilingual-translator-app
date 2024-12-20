#!/bin/sh
# run server commands
python manage.py migrate &&
#python manage.py createsuperuser --noinput &&
python manage.py runserver 0.0.0.0:$1
