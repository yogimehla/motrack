# Android Driver App - Development Guide

## Overview

This is a comprehensive guide for developing and extending the MuulRoute Driver Android application.

## Architecture

### MVVM Pattern (Recommended)
The app currently uses a basic activity-based structure. For scalability, consider implementing:

```
ViewModel → Repository → ApiService
   ↓
LiveData/StateFlow
   ↓
Activity/Fragment
```

### Layers

1. **Presentation Layer** (UI)
   - Activities
   - Fragments
   - ViewModels
   - Adapters

2. **Data Layer** (Data Access)
   - Repository Pattern
   - API Service (Retrofit)
   - Local Database (Room)
   - SharedPreferences

3. **Domain Layer** (Business Logic)
   - Use Cases
   - Models
   - Repositories (interfaces)

## Adding New Features

### 1. Adding a New Activity

**Step 1**: Create the Kotlin class
```kotlin
// app/src/main/kotlin/com/muulroute/driver/ui/activity/YourActivity.kt
package com.muulroute.driver.ui.activity

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.muulroute.driver.databinding.ActivityYourBinding

class YourActivity : AppCompatActivity() {
    private lateinit var binding: ActivityYourBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityYourBinding.inflate(layoutInflater)
        setContentView(binding.root)
    }
}
```

**Step 2**: Create the layout XML
```xml
<!-- app/src/main/res/layout/activity_your.xml -->
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical">
    <!-- Your UI elements -->
</LinearLayout>
```

**Step 3**: Register in AndroidManifest.xml
```xml
<activity
    android:name=".ui.activity.YourActivity"
    android:exported="false" />
```

### 2. Adding API Endpoints

Update `ApiService.kt`:
```kotlin
@GET("endpoint")
suspend fun getYourData(
    @Header("Authorization") token: String
): Response<YourDataResponse>

@POST("endpoint")
suspend fun postYourData(
    @Header("Authorization") token: String,
    @Body request: YourRequest
): Response<BaseResponse>
```

### 3. Adding a Fragment

```kotlin
// app/src/main/kotlin/com/muulroute/driver/ui/fragment/YourFragment.kt
class YourFragment : Fragment() {
    private var _binding: FragmentYourBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentYourBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
```

## Implementing Coroutines

For async operations:
```kotlin
lifecycleScope.launch {
    try {
        val response = withContext(Dispatchers.IO) {
            apiService.getSomeData("token")
        }
        
        if (response.isSuccessful) {
            val data = response.body()
            // Update UI
        }
    } catch (e: Exception) {
        // Handle error
    }
}
```

## Local Database (Room)

### 1. Create Entity
```kotlin
@Entity(tableName = "deliveries")
data class DeliveryEntity(
    @PrimaryKey val id: String,
    val orderId: String,
    val status: String
)
```

### 2. Create DAO
```kotlin
@Dao
interface DeliveryDao {
    @Query("SELECT * FROM deliveries")
    suspend fun getAllDeliveries(): List<DeliveryEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDelivery(delivery: DeliveryEntity)
}
```

### 3. Create Database
```kotlin
@Database(entities = [DeliveryEntity::class], version = 1)
abstract class MuulRouteDatabase : RoomDatabase() {
    abstract fun deliveryDao(): DeliveryDao
}
```

## SharedPreferences Helper

```kotlin
class TokenManager(context: Context) {
    private val sharedPref = context.getSharedPreferences(
        "auth_pref",
        Context.MODE_PRIVATE
    )

    fun saveToken(token: String) {
        sharedPref.edit().putString("token", token).apply()
    }

    fun getToken(): String? {
        return sharedPref.getString("token", null)
    }

    fun clearToken() {
        sharedPref.edit().remove("token").apply()
    }
}
```

## Handling Errors

Create a custom exception handler:
```kotlin
sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val exception: Exception) : Result<Nothing>()
    object Loading : Result<Nothing>()
}

suspend fun <T> safeApiCall(
    apiCall: suspend () -> Response<T>
): Result<T> {
    return try {
        val response = apiCall()
        if (response.isSuccessful) {
            Result.Success(response.body()!!)
        } else {
            Result.Error(Exception(response.message()))
        }
    } catch (e: Exception) {
        Result.Error(e)
    }
}
```

## Testing

### Unit Testing
```kotlin
// app/src/test/kotlin/com/muulroute/driver/LoginTest.kt
class LoginTest {
    @Test
    fun testLoginValidation() {
        val email = "test@example.com"
        val password = "password123"
        // Assert validation logic
    }
}
```

### Instrumented Testing
```kotlin
@RunWith(AndroidJUnit4::class)
class LoginActivityTest {
    @get:Rule
    val activityRule = ActivityScenarioRule(LoginActivity::class.java)

    @Test
    fun testLoginButtonClick() {
        onView(withId(R.id.loginButton)).perform(click())
        // Assert navigation
    }
}
```

## Performance Optimization

1. **Memory Management**
   - Use ViewBinding instead of findViewById
   - Clear resources in onDestroy
   - Use coroutines instead of threads

2. **Network Optimization**
   - Implement request caching
   - Use OkHttp interceptors for logging
   - Compress images before upload

3. **Battery Optimization**
   - Use coarse location when possible
   - Batch location updates
   - Cancel API calls when activity is paused

## Security Best Practices

1. **Token Management**
   - Use EncryptedSharedPreferences for token storage
   - Implement token refresh
   - Clear token on logout

2. **API Communication**
   - Use HTTPS only
   - Implement certificate pinning
   - Add request signing

3. **Data Protection**
   - Encrypt sensitive data
   - Use ProGuard obfuscation
   - Validate all user inputs

## Debugging

### Enable Logging
```kotlin
val logging = HttpLoggingInterceptor()
logging.setLevel(HttpLoggingInterceptor.Level.BODY)
client.addInterceptor(logging)
```

### Logcat Filtering
```bash
adb logcat | grep muulroute
```

### Android Studio Debugger
- Set breakpoints in code
- Step through execution
- Inspect variables in Variables panel

## Building for Distribution

### 1. Update Version
Edit `app/build.gradle`:
```gradle
versionCode 2
versionName "1.1.0"
```

### 2. Create Signed Bundle
- Build → Generate Signed Bundle/APK
- Select "Google Play"
- Choose or create keystore
- Complete the process

### 3. Upload to Play Store
- Go to Google Play Console
- Create app listing
- Upload signed bundle
- Fill metadata and screenshots
- Submit for review

## Common Issues & Solutions

### Issue: Build fails with "Unsupported class-file format"
**Solution**: Update Java version to 11 or higher

### Issue: API calls not working
**Solution**: 
1. Check BASE_URL in ApiService
2. Verify network permissions in manifest
3. Check server is running

### Issue: Location permissions not granted
**Solution**: Request permissions at runtime (targetSdk 31+)

### Issue: Gradle sync fails
**Solution**: 
1. Run `./gradlew clean`
2. File → Invalidate Caches
3. Update gradle wrapper

## Useful Commands

```bash
# Build debug APK
./gradlew assembleDebug

# Build release APK
./gradlew assembleRelease

# Run tests
./gradlew test

# Run instrumented tests
./gradlew connectedAndroidTest

# Check dependencies
./gradlew dependencies

# Update gradle
./gradlew wrapper --gradle-version 8.1
```

## Resources

- [Android Developer Guide](https://developer.android.com)
- [Kotlin Documentation](https://kotlinlang.org/docs)
- [Retrofit Documentation](https://square.github.io/retrofit/)
- [Android Architecture Components](https://developer.android.com/arch)

## Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -m "Add your feature"`
3. Push to branch: `git push origin feature/your-feature`
4. Create pull request

## Support

For questions or issues, contact the development team.
