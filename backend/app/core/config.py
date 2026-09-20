from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    GROQ_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    DATABASE_URL: str = "sqlite:///./shaghoof_teacher.db"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
