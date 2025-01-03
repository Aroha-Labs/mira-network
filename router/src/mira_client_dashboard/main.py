from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.mira_client_dashboard.api.v1 import router as v1_router
from src.mira_client_dashboard.db.base import engine
from sqlmodel import SQLModel
import uvicorn
from prometheus_fastapi_instrumentator import Instrumentator


app = FastAPI()
Instrumentator().instrument(app).expose(app)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables
SQLModel.metadata.create_all(engine)

# Include routers
app.include_router(v1_router)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

@app.get("/")
def read_root():
    return {"message": "Welcome to the FastAPI service"}

@app.get("/health")
def health_check():
    return {"status": "ok"}