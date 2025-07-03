from typing import List, Optional
from pydantic import BaseModel

class Command(BaseModel):
    Command: str
    Target: str
    Value: Optional[str] = ""
    Targets: Optional[List[str]] = []
    Description: Optional[str] = ""

class ScriptRequest(BaseModel):
    Name: str
    CreationDate: str
    Commands: List[Command]

class ScriptResponse(BaseModel):
    language: str
    code: str
