import json
import os

file_path = r"C:\dev\process-coaching\L3456_example.md"

# Try different encodings
content = ""
for enc in ['utf-8', 'utf-8-sig', 'euc-kr', 'cp949']:
    try:
        with open(file_path, 'r', encoding=enc) as f:
            content = f.read()
        break
    except UnicodeDecodeError:
        continue

lines = content.strip().split('\n')
data_dict = {}

for line in lines:
    if not line.strip() or '|' not in line:
        continue
    parts = [p.strip() for p in line.split('|')]
    if len(parts) < 5:
        continue
    
    l3 = parts[1]
    l4 = parts[2]
    l5 = parts[3]
    l6 = parts[4]

    if l3 == "기능(L3)" or l3.startswith("---") or not l3:
        continue

    if l3 not in data_dict:
        data_dict[l3] = {}
    if l4 not in data_dict[l3]:
        data_dict[l3][l4] = {}
    if l5 not in data_dict[l3][l4]:
        data_dict[l3][l4][l5] = []
    
    if l6 and l6 not in data_dict[l3][l4][l5] and l6 != "-":
        data_dict[l3][l4][l5].append(l6)

hrModules = []
for l3, l4_dict in data_dict.items():
    l4_list = []
    for l4, l5_dict in l4_dict.items():
        tasks = []
        for l5, l6_list in l5_dict.items():
            tasks.append({"l5": l5, "l6_activities": l6_list})
        l4_list.append({"l4": l4, "tasks": tasks})
    hrModules.append({"l3": l3, "l4_list": l4_list})

ts_file_path = r"C:\dev\process-coaching\frontend\src\data\processData.ts"
with open(ts_file_path, 'w', encoding='utf-8') as f:
    f.write("import { HRModule } from '../types';\n\n")
    f.write("export const hrModules: HRModule[] = ")
    f.write(json.dumps(hrModules, ensure_ascii=False, indent=2))
    f.write(";\n")

print("Successfully written to processData.ts")
