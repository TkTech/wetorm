# This file runs once the first time you hit run, and sets up the
# Django environment for WetORM. Customize to fit your needs and
# hit run again to apply changes.
import os
import sys
import types

os.environ.setdefault('DJANGO_ALLOW_ASYNC_UNSAFE', 'true')

# Create a fake wetorm module
wetorm_module = types.ModuleType('wetorm')
wetorm_module.__file__ = '<wetorm>'
wetorm_module.__path__ = []
sys.modules['wetorm'] = wetorm_module

# Set up Django configuration
from django.conf import settings

if not settings.configured:
    settings.configure(
        DATABASES={
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': ':memory:',
            }
        },
        INSTALLED_APPS=[
            'django.contrib.contenttypes',
            'django.contrib.auth',
            'wetorm',
        ],
        SECRET_KEY='wetorm-development-key',
        DEBUG=True,
        USE_TZ=False,
        USE_I18N=True,
        USE_L10N=True,
        TIME_ZONE='UTC',
        TEMPLATES=[
            {
                'BACKEND': 'django.template.backends.django.DjangoTemplates',
                'DIRS': [],
                'APP_DIRS': True,
                'OPTIONS': {
                    'context_processors': [
                        'django.template.context_processors.debug',
                        'django.template.context_processors.request',
                        'django.contrib.auth.context_processors.auth',
                        'django.contrib.messages.context_processors.messages',
                    ],
                },
            },
        ],
        DEFAULT_AUTO_FIELD='django.db.models.BigAutoField',
        LOGGING={
            'version': 1,
            'disable_existing_loggers': False,
            'handlers': {
                'console': {
                    'class': 'logging.StreamHandler',
                },
            },
            'loggers': {
                'django.db.backends': {
                    'handlers': ['console'],
                    'level': 'DEBUG',
                },
            },
        }
    )
    
    import django
    django.setup()