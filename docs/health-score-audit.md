# Health Score Calculation Audit

### 1. LOCATION: Core Logic
The entire core mathematical algorithm is completely abstracted away from the mobile app. The frontend only displays the computed data payload.
The core logic resides exclusively in the backend at:
*   `artifacts/api-server/src/lib/scoring.ts` -> Specifically the `computeScientificScore()` function.
*   `artifacts/api-server/src/lib/activityScore.ts` -> Simplified fallback activity tracking percentage calculation.

### 2. DATA INPUTS
The final Health Score takes in 7 specific domains to compute its value:
1.  **Food/Nutrition**: Calories consumed, protein (g), fiber (g), number of meals, and micronutrients.
2.  **Exercise**: Total MET (Metabolic Equivalent) minutes, duration, calories burned, and number of exercise sessions.
3.  **Water**: Total millilitres / glasses of water consumed.
4.  **Medicine**: Number of medicine doses taken versus the number scheduled for the day.
5.  **Sleep**: Total hours slept and qualitative sleep quality rating (poor, fair, good, excellent).
6.  **Stress**: Raw stress score (likely from PPG scans) and mood check-ins.
7.  **BMI (Body Mass Index)**: Real-time recalculation using weight (kg) and height (cm).

### 3. THE ALGORITHM/MATH & WEIGHTAGE
The final composite score (out of 100) is generated via a weighted WHO/ICMR matrix:
*   **Food (28%)**: Calculated via dynamic goals. Hits 100% if calories are ±10% of target.
*   **Exercise (22%)**: Based on WHO guidelines targeting `85.7 MET-min` per day.
*   **Water (13%)**: Compares consumed glasses vs baseline goal.
*   **Medicine (12%)**: Directly calculates `(Taken / Scheduled) * 100`.
*   **Sleep (10%)**: Optimal 7-9 hours gives 100 points.
*   **Stress (10%)**: 0-100 inversion adjusted ±5 to ±10 points via mood.
*   **BMI (5%)**: Standard brackets (e.g., 18.5 - 22.9 = 100 points).

### 4. MISSING DATA HANDLING
*   **Medicine**: If a user has *no active medicine schedules*, they get a perfect `100` score.
*   **Sleep/Stress**: If no check-in exists for the day, it applies a neutral fallback score of `85`.
*   **Food/Water/Exercise**: Missing logs result in a `0` score for that block.

### 5. FRONTEND PLUG-AND-PLAY VERIFICATION
The mobile app hits `GET /health/score/:date`. Because the math is entirely processed server-side, you can upgrade the weightage algorithm inside `scoring.ts` at any time and the React Native app will seamlessly display the new numbers without requiring an app store update.
