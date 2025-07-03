def convert_to_robot_script(commands: list) -> str:
    robot_lines = [
        "*** Settings ***",
        "Library    SeleniumLibrary",
        "",
        "*** Test Cases ***",
        "",
        "Generated Test"
    ]

    open_browser_handled = False

    for cmd in commands:
        command = cmd.get("Command", "").lower()
        target = cmd.get("Target", "")
        value = cmd.get("Value", "").strip()

        # Use XPath first from Targets
        if "Targets" in cmd:
            if any(t.startswith("xpath=") for t in cmd["Targets"]):
                target = next(t for t in cmd["Targets"] if t.startswith("xpath="))
            elif any(t.startswith("id=") for t in cmd["Targets"]):
                id_value = next(t.split("=", 1)[1] for t in cmd["Targets"] if t.startswith("id="))
                target = f'xpath=//*[@id="{id_value}"]'
            elif any(t.startswith("name=") for t in cmd["Targets"]):
                name_value = next(t.split("=", 1)[1] for t in cmd["Targets"] if t.startswith("name="))
                target = f'xpath=//*[@name="{name_value}"]'
            elif any(t.startswith("css=") for t in cmd["Targets"]):
                continue  # CSS non supporté

        # Normalize single target if still needed
        if target.startswith("xpath="):
            pass
        elif target.startswith("//") or target.startswith("(//"):
            target = f"xpath={target}"
        elif target.startswith("id="):
            target = f'xpath=//*[@id="{target.split("=", 1)[1]}"]'
        elif target.startswith("css="):
            continue
        elif target.startswith("linkText="):
            text = target.split("=", 1)[1]
            target = f'xpath=//a[contains(text(), "{text}")]'
        elif target:
            target = f'xpath={target}'

        # Map command to Robot Framework keywords
        if command == "open" and not open_browser_handled:
            robot_lines.append(f"    Open Browser    {target.replace('xpath=', '')}    chrome")
            robot_lines.append("    Set Selenium Timeout    10 seconds")
            robot_lines.append("    Set Selenium Speed    0.5s")
            open_browser_handled = True
        elif command == "click":
            robot_lines.append(f"    Click Element    {target}")
        elif command == "clickandwait":
            robot_lines.append(f"    Click Element    {target}")
            robot_lines.append("    Sleep    2s")
        elif command == "type":
            robot_lines.append(f"    Input Text    {target}    {value}")
        elif command == "select":
            robot_lines.append(f"    Select From List By Label    {target}    {value}")
        elif command == "pause":
            robot_lines.append(f"    Sleep    {value}s")
        elif command == "asserttext":
            robot_lines.append(f"    Element Text Should Be    {target}    {value}")
        elif command == "store":
            pass  # no-op for now
        elif command == "sendkeys":
            robot_lines.append(f"    Press Keys    {target}    {value}")
        else:
            robot_lines.append(f"    # Unsupported command: {command} - {target} - {value}")

    robot_lines.append("    Close Browser")
    return "\n".join(robot_lines)
