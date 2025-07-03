def escape_quotes(s: str) -> str:
    return s.replace('\\', '\\\\').replace('"', '\\"')

def clean_target(target: str) -> str:
    # Supprime les préfixes xpath= ou css= si présents
    if target.startswith("xpath="):
        return target[len("xpath="):]
    elif target.startswith("css="):
        return target[len("css="):]
    return target

def generate_selenium_python(commands):
    code = [
        "from selenium import webdriver",
        "from selenium.webdriver.common.by import By",
        "from selenium.webdriver.common.keys import Keys",
        "import time",
        "",
        "driver = webdriver.Chrome()"
    ]

    for cmd in commands:
        c = cmd["Command"].lower()
        target = clean_target(cmd["Target"])
        value = cmd.get("Value", "")

        if c == "open":
            code.append(f'driver.get("{escape_quotes(target)}")')

        elif c == "click":
            code.append(
                f'driver.find_element(By.XPATH, "{escape_quotes(target)}").click()'
            )

        elif c == "type":
            code.append(
                f'driver.find_element(By.XPATH, "{escape_quotes(target)}").send_keys("{escape_quotes(value)}")'
            )

        else:
            code.append(f'# Unsupported command: {c}')

    code.append("\n# Optional: keep browser open for 5 seconds then quit")
    code.append("time.sleep(5)")
    code.append("driver.quit()")

    # Return the generated Python code as a single string with line breaks
    return "\n".join(code)



def generate_robot_framework_script(commands):
    # Start with the necessary headers and test case declaration
    code = [
        "*** Settings ***",
        "Library    SeleniumLibrary",
        "",
        "*** Test Cases ***",
        "Generated Test"
    ]

    # Use the first 'open' command as the URL for 'Open Browser'
    url = ""
    if commands:
        first_cmd = commands[0]
        if first_cmd["Command"].lower() == "open":
            url = first_cmd["Target"]

    if url:
        code.append(f"    Open Browser    {url}    chrome")

    # Iterate over the rest of the commands and convert them
    for cmd in commands[1:]:
        command = cmd["Command"].lower()
        target = cmd["Target"]
        value = cmd.get("Value", "")

        if command == "type":
            code.append(f"    Input Text    {target}    {value}")
        elif command == "click":
            code.append(f"    Click Element    {target}")
        else:
            code.append(f"    # Unsupported command: {command}")

    code.append("    Close Browser")

    # Join all lines into a single string with line breaks
    return "\n".join(code)
