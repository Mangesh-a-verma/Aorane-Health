import re

with open('artifacts/aorane-mobile/app/(tabs)/food.tsx', 'r') as f:
    content = f.read()

# Replace DbResults .map with FlatList
# Replace histResults .map with FlatList
# For dbResults:
content = content.replace("""{dbResults.slice(0, 8).map((item, i) => (
                    <TouchableOpacity
                      key={String(item.id)}
                      onPress={() => logItem({ foodNameEn: String(item.foodNameEn), calories: Number(item.calories), proteinG: Number(item.proteinG||0), carbsG: Number(item.carbsG||0), fatG: Number(item.fatG||0), fiberG: Number(item.fiberG||0) }, "text")}
                      disabled={submitting}
                      style={[s.resultRow, i > 0 && s.resultRowBorder]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.resultName}>{String(item.foodNameEn)}</Text>
                        <Text style={s.resultCal}>{Math.round(Number(item.calories))} kcal per 100g</Text>
                      </View>
                      <View style={s.addBtn}>
                        <Plus size={16} color="#FFF" />
                      </View>
                    </TouchableOpacity>
                  ))}""", """<FlatList
                    data={dbResults.slice(0, 8)}
                    keyExtractor={item => String(item.id)}
                    initialNumToRender={8}
                    scrollEnabled={false}
                    renderItem={({ item, index }) => (
                      <TouchableOpacity
                        onPress={() => logItem({ foodNameEn: String(item.foodNameEn), calories: Number(item.calories), proteinG: Number(item.proteinG||0), carbsG: Number(item.carbsG||0), fatG: Number(item.fatG||0), fiberG: Number(item.fiberG||0) }, "text")}
                        disabled={submitting}
                        style={[s.resultRow, index > 0 && s.resultRowBorder]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={s.resultName}>{String(item.foodNameEn)}</Text>
                          <Text style={s.resultCal}>{Math.round(Number(item.calories))} kcal per 100g</Text>
                        </View>
                        <View style={s.addBtn}>
                          <Plus size={16} color="#FFF" />
                        </View>
                      </TouchableOpacity>
                    )}
                  />""")

content = content.replace("""{histResults.map((item, i) => (
                    <TouchableOpacity
                      key={item.foodNameEn}
                      onPress={() => logItem(item, "text")}
                      disabled={submitting}
                      style={[s.resultRow, i > 0 && s.resultRowBorder]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.resultName}>{item.foodNameEn}</Text>
                        <Text style={s.resultCal}>{Math.round(item.calories)} kcal · eaten {item.count}x</Text>
                      </View>
                      <View style={s.addBtn}>
                        <Plus size={16} color="#FFF" />
                      </View>
                    </TouchableOpacity>
                  ))}""", """<FlatList
                    data={histResults}
                    keyExtractor={item => item.foodNameEn}
                    initialNumToRender={5}
                    scrollEnabled={false}
                    renderItem={({ item, index }) => (
                      <TouchableOpacity
                        onPress={() => logItem(item, "text")}
                        disabled={submitting}
                        style={[s.resultRow, index > 0 && s.resultRowBorder]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={s.resultName}>{item.foodNameEn}</Text>
                          <Text style={s.resultCal}>{Math.round(item.calories)} kcal · eaten {item.count}x</Text>
                        </View>
                        <View style={s.addBtn}>
                          <Plus size={16} color="#FFF" />
                        </View>
                      </TouchableOpacity>
                    )}
                  />""")

with open('artifacts/aorane-mobile/app/(tabs)/food.tsx', 'w') as f:
    f.write(content)
