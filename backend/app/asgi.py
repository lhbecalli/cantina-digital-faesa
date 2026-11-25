"""Ponto de entrada ASGI: uvicorn app.asgi:app"""
from .main import create_app

app = create_app()
