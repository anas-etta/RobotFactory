from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.responses import FileResponse
import json
import tempfile
import os
from models import Command
from parser import generate_selenium_python
from robot_parser import convert_to_robot_script

app = FastAPI()

@app.post("/generate-script-from-file")
async def generate_script_from_file(
    file: UploadFile = File(...),
    language: str = Query("python", pattern="^(python|robot)$", description="Target script language: 'python' or 'robot'")
):
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Le fichier doit être un JSON")

    contents = await file.read()
    try:
        data = json.loads(contents)
        commands = [Command(**cmd) for cmd in data.get("Commands", [])]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur de lecture JSON : {e}")

    if language == "python":
        code = generate_selenium_python([cmd.dict() for cmd in commands])
        suffix = ".py"
    else:
        code = convert_to_robot_script([cmd.dict() for cmd in commands])
        suffix = ".robot"

    # Créer un fichier temporaire
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, mode="w", encoding="utf-8") as temp_file:
        temp_file.write(code)
        temp_file_path = temp_file.name

    # Retourner le fichier
    filename = f"generated_script{suffix}"
    return FileResponse(temp_file_path, filename=filename, media_type="application/octet-stream")
