def extract_variables(prompt):
    # Use regex to find all text within {}
    import re
    pattern = r"\{([^}]+)\}"
    variables = re.findall(pattern, prompt)
    return variables