def escape_quotes(s: str) -> str:
    return s.replace('\\', '\\\\').replace('"', '\\"')

def normalize_target(cmd):
    """
    Chooses the best locator for Selenium and returns a tuple (By, locator)
    """
    targets = cmd.get("Targets", [])
    target = cmd.get("Target", "")

    if targets:
        if any(t.startswith("xpath=") for t in targets):
            locator = next(t for t in targets if t.startswith("xpath="))[len("xpath="):]
            return ("xpath", locator)
        elif any(t.startswith("id=") for t in targets):
            id_value = next(t.split("=", 1)[1] for t in targets if t.startswith("id="))
            return ("id", id_value)
        elif any(t.startswith("name=") for t in targets):
            name_value = next(t.split("=", 1)[1] for t in targets if t.startswith("name="))
            return ("name", name_value)
        elif any(t.startswith("linkText=") for t in targets):
            link_text = next(t.split("=", 1)[1] for t in targets if t.startswith("linkText="))
            return ("link_text", link_text)
        elif any(t.startswith("css=") for t in targets):
            return (None, None)  # skip unsupported

    if target.startswith("xpath="):
        return ("xpath", target[len("xpath="):])
    elif target.startswith("//") or target.startswith("(//"):
        return ("xpath", target)
    elif target.startswith("id="):
        return ("id", target.split("=", 1)[1])
    elif target.startswith("name="):
        return ("name", target.split("=", 1)[1])
    elif target.startswith("linkText="):
        return ("link_text", target.split("=", 1)[1])
    elif target.startswith("css="):
        return (None, None)  # skip unsupported
    elif target:
        return ("xpath", target)
    return ("xpath", "")

def generate_selenium_python(commands):
    code = [
        "from selenium import webdriver",
        "from selenium.webdriver.common.by import By",
        "from selenium.webdriver.support.ui import Select",
        "from selenium.webdriver.common.keys import Keys",
        "import time",
        "",
        "driver = webdriver.Chrome()",
        "driver.implicitly_wait(10)",
        "driver.maximize_window()",
    ]

    open_handled = False

    for cmd in commands:
        c = cmd.get("Command", "").lower()
        value = cmd.get("Value", "").strip()
        by, locator = normalize_target(cmd)

        # Skip unsupported locators
        if by is None or locator is None:
            code.append(f'# Skipped unsupported locator in command: {c}')
            continue

        if c == "open" and not open_handled:
            code.append(f'driver.get("{escape_quotes(locator)}")')
            open_handled = True
        elif c == "click":
            code.append(f'driver.find_element(By.{by.upper()}, "{escape_quotes(locator)}").click()')
            code.append('time.sleep(1)  # Slow down after clicking')
        elif c == "clickandwait":
            code.append(f'driver.find_element(By.{by.upper()}, "{escape_quotes(locator)}").click()')
            code.append('time.sleep(2)  # Wait after clicking and waiting')
        elif c in ("type", "input"):
            if value:
                code.append(f'driver.find_element(By.{by.upper()}, "{escape_quotes(locator)}").clear()')
                code.append(f'driver.find_element(By.{by.upper()}, "{escape_quotes(locator)}").send_keys("{escape_quotes(value)}")')
                code.append('time.sleep(0.5)  # Slow down after typing')
            else:
                code.append(f'driver.find_element(By.{by.upper()}, "{escape_quotes(locator)}").click()')
                code.append('time.sleep(1)  # Click when type/input has no value')
        elif c == "select":
            code.append(f'Select(driver.find_element(By.{by.upper()}, "{escape_quotes(locator)}")).select_by_visible_text("{escape_quotes(value)}")')
            code.append('time.sleep(0.5)  # Slow down after selecting')
        elif c == "pause":
            try:
                seconds = float(value)
            except Exception:
                seconds = 1
            code.append(f"time.sleep({seconds})")
        elif c == "asserttext":
            code.append(f'assert driver.find_element(By.{by.upper()}, "{escape_quotes(locator)}").text == "{escape_quotes(value)}", "Assertion failed: element text does not match"')
        elif c == "sendkeys":
            code.append(f'driver.find_element(By.{by.upper()}, "{escape_quotes(locator)}").send_keys("{escape_quotes(value)}")')
            code.append('time.sleep(0.3)  # Slow down after sendkeys')
        else:
            code.append(f'# Unsupported command: {c} - {by} - {locator} - {value}')

    code.append("\n# Optional: keep browser open for 5 seconds then quit")
    code.append("time.sleep(5)")
    code.append("driver.quit()")

    return "\n".join(code)