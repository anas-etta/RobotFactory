from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.responses import PlainTextResponse
import json
from models import Command
from parser import generate_selenium_python
from robot_parser import convert_to_robot_script

app = FastAPI()

@app.post("/generate-script-from-file")
async def generate_script_from_file(
    file: UploadFile = File(...),
    language: str = Query("selenium", pattern="^(selenium|robot)$", description="Target script language: 'selenium' or 'robot'")
):
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="The file must be a .json file.")
    
    contents = await file.read()
    if not contents or contents.strip() == b'':
        raise HTTPException(status_code=400, detail="The JSON file is empty.")

    try:
        data = json.loads(contents)
        if not isinstance(data, dict) or "Commands" not in data:
            raise ValueError("The JSON file must contain a 'Commands' key.")
        commands = [Command(**cmd) for cmd in data.get("Commands", [])]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"JSON read error: {e}")

    if language == "selenium":
        code = generate_selenium_python([cmd.dict() for cmd in commands])
    else:
        code = convert_to_robot_script([cmd.dict() for cmd in commands])

    if not code or code.strip() == "":
        raise HTTPException(status_code=400, detail="No script could be generated from this JSON file.")

    return PlainTextResponse(content=code, media_type="text/plain")