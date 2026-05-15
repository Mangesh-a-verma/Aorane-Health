import re

with open('artifacts/aorane-mobile/app/(tabs)/exercise.tsx', 'r') as f:
    content = f.read()

# Replace logs.map with FlatList in exercise.tsx
logs_pattern = re.compile(r"logs\.map\(\(log\) => \{.*?return \((.*?)\);\s*\}\)", re.DOTALL)

# Because there are other elements in the scroll view, doing a direct string replace might be tricky if we want to change the parent ScrollView to FlatList.
# Wait, logs.map is inside a ScrollView. We can replace just the logs.map with a FlatList that has scrollEnabled={false} or we can migrate the outer ScrollView if it only contains the list.
# Let's check the structure of exercise.tsx
