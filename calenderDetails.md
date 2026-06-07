# Workout Calendar System Documentation

## Table of Contents
1. [Overview](#overview)
2. [API Endpoints](#api-endpoints)
3. [Get Athlete Calendar](#get-athlete-calendar)
4. [Assign Workout to Calendar](#assign-workout-to-calendar)
5. [Controller Logic](#controller-logic)
6. [Data Models](#data-models)
7. [Business Rules](#business-rules)
8. [Usage Examples](#usage-examples)

---

## Overview

The Workout Calendar system allows coaches to manage and assign workouts to their subscribed athletes on a weekly basis. The calendar is automatically generated based on the athlete's subscription period and training frequency.

**Key Features:**
- Automatic calendar generation based on subscription dates
- 4-week structure aligned with subscription period
- Dynamic week opening (current week + next week within 2 days)
- Training frequency customization (2-7 days per week)
- Workout assignment tracking
- Completion status monitoring

---

## API Endpoints

### 1. Get Athlete Calendar

**Route:** `GET /api/coaches/athletes/:athleteId/calendar`

**Authentication:** Required (Coach role only)

**Description:** Retrieves or creates a workout calendar for a specific athlete based on their active subscription.

#### Request

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `athleteId` | ObjectId | Yes | The User ID of the athlete |

**Headers:**
```http
Authorization: Bearer <coach_jwt_token>

**Example API:**
```
GET /api/coaches/athletes/6a11a0501a7bb4354b505918/calendar
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Success Response

```json
{
  "status": "success",
  "message": "Calendar retrieved successfully",
  "data": {
    "calendarId": "6a1779beb700955846c05698",
    "subscriptionPeriod": {
      "startDate": "2026-06-01T00:00:00.000Z",
      "endDate": "2026-06-30T23:59:59.999Z"
    },
    "trainingFrequency": 5,
    "weeks": [
      {
        "weekNumber": 1,
        "startDate": "2026-06-01T00:00:00.000Z",
        "endDate": "2026-06-07T23:59:59.999Z",
        "isOpen": true,
        "trainingDays": [
          {
            "dayNumber": 1,
            "date": "2026-06-01T00:00:00.000Z",
            "isAssigned": false,
            "completedAt": null,
            "workout": null
          },
          {
            "dayNumber": 2,
            "date": "2026-06-02T00:00:00.000Z",
            "isAssigned": true,
            "completedAt": null,
            "workout": {
              "id": "workout_id_123",
              "name": "Upper Body Strength",
              "description": "Focus on chest and back",
              "type": "gym"
            }
          }
        ]
      }
    ]
  }
}



### Error Responses

#### 403 Forbidden - No Active Subscription:
```json
{
  "status": "error",
  "message": "No active subscription found for this athlete",
  "data": null
}
```