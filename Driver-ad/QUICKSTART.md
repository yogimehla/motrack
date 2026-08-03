# Quick Start Guide - Android Driver App

## 5-Minute Setup

### Prerequisites
- Android Studio (latest version)
- Java 11+
- Android SDK API 24+

### Step 1: Open Project
1. Launch Android Studio
2. Click "Open" → Select `Driver-ad` folder
3. Wait for Gradle sync (2-5 minutes)

### Step 2: Configure API
Edit `app/src/main/kotlin/com/muulroute/driver/data/api/ApiService.kt`:
```kotlin
private const val BASE_URL = "http://your-backend-url/api/"
```

### Step 3: Run App
1. Click the green "Run" button (or Shift+F10)
2. Select device/emulator
3. Wait for build to complete (~1-2 min)

### Step 4: Test Login
- **Email**: test@example.com
- **Password**: password123

## Project Structure at a Glance

```
Driver-ad/
├── app/
│   ├── src/main/
│   │   ├── kotlin/          ← Kotlin source code
│   │   │   └── com/muulroute/driver/
│   │   │       ├── MainActivity.kt
│   │   │       ├── data/api/
│   │   │       └── ui/activity/
│   │   ├── res/             ← Resources (layouts, strings, colors)
│   │   │   ├── layout/
│   │   │   ├── values/
│   │   │   └── drawable/
│   │   └── AndroidManifest.xml
│   └── build.gradle         ← App dependencies
├── build.gradle             ← Project configuration
├── settings.gradle          ← Module settings
├── gradle.properties        ← Gradle settings
└── README.md
```

## Key Files

| File | Purpose |
|------|---------|
| `MainActivity.kt` | App entry point, permission handling |
| `LoginActivity.kt` | User authentication |
| `DashboardActivity.kt` | Delivery list & management |
| `DeliveryDetailActivity.kt` | Delivery details & actions |
| `ApiService.kt` | API client & data models |
| `activity_*.xml` | UI layouts |
| `strings.xml` | Text resources |
| `colors.xml` | Color definitions |

## Common Tasks

### Run App
```bash
./gradlew installDebug
```

### Build APK
```bash
./gradlew assembleDebug
```

### View Logs
```bash
adb logcat | grep muulroute
```

### Clean & Rebuild
```bash
./gradlew clean build
```

## Features Included

✅ **Login Screen** - Email & password authentication
✅ **Dashboard** - View delivery count & accept deliveries
✅ **Delivery Details** - View location & manage delivery
✅ **Location Permissions** - GPS access on app start
✅ **API Integration** - Retrofit networking setup
✅ **Kotlin Coroutines** - Async operations
✅ **Material Design** - Modern UI components

## Next Steps

1. **Update API Endpoint** - Point to your backend
2. **Add More Screens** - Use existing activities as templates
3. **Implement Database** - Add local storage with Room
4. **Add Tests** - Write unit & instrumented tests
5. **Configure Firebase** - For push notifications
6. **Build Release APK** - For Play Store submission

## Troubleshooting

**Build fails?**
- Run `./gradlew clean`
- Invalidate caches in Android Studio
- Update Java version to 11+

**Emulator is slow?**
- Enable hardware acceleration
- Allocate more RAM to emulator
- Use x86_64 emulator image

**Permissions not working?**
- Check Android version (runtime permissions for Android 6+)
- Verify manifest has required permissions
- Test on physical device

## Testing

### Test Login
1. Open app
2. Enter credentials
3. Click "Login"
4. Should navigate to Dashboard

### Test Delivery Acceptance
1. From Dashboard click "Accept Delivery"
2. Review delivery details
3. Click "Accept" or "Decline"

## Important Links

- [API Documentation](#) - Update with your API docs
- [Android Studio Docs](https://developer.android.com/docs)
- [Kotlin Docs](https://kotlinlang.org/docs)

## Need Help?

1. Check `README.md` for detailed documentation
2. Read `DEVELOPMENT.md` for architecture & patterns
3. Check Android Studio's logcat for errors
4. Search Android developers documentation

---

**Tip**: Keep `gradle.properties` handy to enable offline mode or adjust JVM args for better performance.
