import re

with open('artifacts/aorane-mobile/app/(tabs)/dashboard.tsx', 'r') as f:
    content = f.read()

# Fix the closing brace issue from earlier string replace
# Original end of SummaryBanner was:
#        ))}
#      </View>
#    </LinearGradient>
#  );
#}
# Now it's missing the closing });

content = content.replace(
"""        ))}
      </View>
    </LinearGradient>
  );
}
const bn = StyleSheet.create({""",
"""        ))}
      </View>
    </LinearGradient>
  );
});
const bn = StyleSheet.create({"""
)

with open('artifacts/aorane-mobile/app/(tabs)/dashboard.tsx', 'w') as f:
    f.write(content)
