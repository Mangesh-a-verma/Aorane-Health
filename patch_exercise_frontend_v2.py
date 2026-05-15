import re

with open('artifacts/aorane-mobile/app/(tabs)/exercise.tsx', 'r') as f:
    content = f.read()

# Add FlatList to imports
content = content.replace("Platform, Dimensions,", "Platform, Dimensions, FlatList,")

replacement = """<FlatList
            data={logs}
            keyExtractor={log => log.id}
            initialNumToRender={5}
            scrollEnabled={false}
            renderItem={({ item: log }) => {
              const ex  = EXERCISE_LIST.find((e) => e.name === log.exerciseType);
              const clr = ex?.color || P;
              const ico = ex?.icon || "run-fast";
              const hasStrengthDetails = log.sets || log.reps;
              const hasSteps = log.steps && Number(log.steps) > 0;
              return (
                <View style={s.logCard}>
                  <View style={[s.logIcon, { backgroundColor: clr + "18" }]}>
                    <MaterialCommunityIcons name={ico as keyof typeof MaterialCommunityIcons.glyphMap} size={22} color={clr} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.logName}>{log.exerciseType}</Text>
                    <Text style={s.logDetails}>
                      {log.durationMinutes} min · {log.intensity}
                      {log.metValue ? ` · MET ${Number(log.metValue).toFixed(1)}` : ""}
                    </Text>
                    {hasStrengthDetails && (
                      <View style={s.detailPills}>
                        {log.sets ? (
                          <View style={s.pill}>
                            <Text style={s.pillText}>{log.sets} sets</Text>
                          </View>
                        ) : null}
                        {log.reps ? (
                          <View style={s.pill}>
                            <Text style={s.pillText}>{log.reps} reps</Text>
                          </View>
                        ) : null}
                      </View>
                    )}
                    {hasSteps && (
                      <Text style={s.logStep}>🐾 {parseInt(log.steps as unknown as string).toLocaleString()} steps tracked</Text>
                    )}
                  </View>
                  <View style={s.logRight}>
                    <Text style={s.logCal}>{Math.round(Number(log.caloriesBurned))} kcal</Text>
                    <TouchableOpacity onPress={() => handleDelete(log.id)} style={s.deleteBtn} activeOpacity={0.7}>
                      <Ionicons name="trash-outline" size={18} color={DS.color.red} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />"""

content = re.sub(
    r"logs\.map\(\(log\) => \{.*?<\/View>\s*\);\s*\}\)",
    replacement,
    content,
    flags=re.DOTALL
)

with open('artifacts/aorane-mobile/app/(tabs)/exercise.tsx', 'w') as f:
    f.write(content)
