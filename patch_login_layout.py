import re

with open('artifacts/business-portal/src/pages/Login.tsx', 'r') as f:
    content = f.read()

# We need to render only the right side of the split view if isModal is true
old_layout = """    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", background: BG }}>
      <Helmet>
        <title>Business Portal | Login</title>
      </Helmet>

      <div style={{
        display: "flex", width: "100%", maxWidth: 1000, background: "white",
        borderRadius: 24, overflow: "hidden", boxShadow: "0 20px 40px rgba(0,0,0,0.08)",
        border: "1px solid rgba(0,0,0,0.05)"
      }}>
        {/* Left Side - Brand & Features (Hidden on small screens) */}
        <div style={{ flex: 1, padding: "40px", display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", zIndex: 1, background: "linear-gradient(135deg, #005d90 0%, #003a5c 100%)", color: "white" }}>"""

new_layout = """    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", background: isModal ? "transparent" : BG }}>
      {!isModal && (
        <Helmet>
          <title>Business Portal | Login</title>
        </Helmet>
      )}

      <div style={{
        display: "flex", width: "100%", maxWidth: isModal ? "100%" : 1000, background: "white",
        borderRadius: isModal ? 0 : 24, overflow: "hidden", boxShadow: isModal ? "none" : "0 20px 40px rgba(0,0,0,0.08)",
        border: isModal ? "none" : "1px solid rgba(0,0,0,0.05)", margin: isModal ? 0 : "40px 20px"
      }}>
        {/* Left Side - Brand & Features (Hidden on small screens or inside Modal) */}
        {!isModal && (
        <div style={{ flex: 1, padding: "40px", display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", zIndex: 1, background: "linear-gradient(135deg, #005d90 0%, #003a5c 100%)", color: "white" }}>"""

content = content.replace(old_layout, new_layout)

# Close the !isModal div
# Let's find the Right Side form start
old_right_side = """        {/* Right Side - Login Form */}
        <div style={{ flex: 1, padding: "40px", position: "relative" }}>"""

new_right_side = """        </div>
        )}
        {/* Right Side - Login Form */}
        <div style={{ flex: 1, padding: "40px", position: "relative" }}>"""

content = content.replace(old_right_side, new_right_side)

with open('artifacts/business-portal/src/pages/Login.tsx', 'w') as f:
    f.write(content)
