import json
import codecs

# Read the file with latin-1 encoding (which preserves the bytes)
with open('data/questions.json', 'r', encoding='latin-1') as f:
    content = f.read()

# The content is actually UTF-8 but was read as latin-1
# So we need to encode it back to bytes with latin-1 and decode as UTF-8
content_bytes = content.encode('latin-1')
proper_content = content_bytes.decode('utf-8')

# Now parse the JSON
questions_data = json.loads(proper_content)

# Write it back properly with UTF-8
with open('data/questions.json', 'w', encoding='utf-8') as f:
    json.dump(questions_data, f, ensure_ascii=False, indent=2)

print("✅ Fixed Hindi encoding in questions.json!")
print(f"Total subjects: {len(questions_data)}")
for subject_id, questions in questions_data.items():
    print(f"  {subject_id}: {len(questions)} questions")
