# MuulRoute Driver - Android Native App

A native Android application for delivery drivers to manage and track deliveries using MuulRoute platform.

## Tech Stack

- **Language**: Kotlin
- **Build System**: Gradle
- **API Client**: Retrofit 2
- **JSON Parser**: Gson
- **Location Services**: Google Play Services
- **Maps**: Mapbox
- **Minimum SDK**: Android 7.0 (API 24)
- **Target SDK**: Android 14 (API 34)

## Project Structure

```
Driver-ad/
├── app/
│   ├── src/main/
│   │   ├── kotlin/com/muulroute/driver/
│   │   │   ├── MainActivity.kt
│   │   │   ├── data/
│   │   │   │   └── api/
│   │   │   │       └── ApiService.kt
│   │   │   └── ui/activity/
│   │   │       ├── LoginActivity.kt
│   │   │       ├── DashboardActivity.kt
│   │   │       └── DeliveryDetailActivity.kt
│   │   ├── res/
│   │   │   ├── layout/
│   │   │   ├── values/
│   │   │   ├── drawable/
│   │   │   └── xml/
│   │   └── AndroidManifest.xml
│   ├── build.gradle
│   └── proguard-rules.pro
├── build.gradle
├── settings.gradle
├── gradle.properties
└── README.md
```

## Setup & Installation

### Prerequisites

- Android Studio (latest version)
- JDK 11 or higher
- Android SDK (API 24+)
- Gradle 8.0+

### Steps to Build

1. **Clone the repository**
   ```bash
   cd motrack/Driver-ad
   ```

2. **Open with Android Studio**
   - File → Open → Select Driver-ad folder
   - Wait for Gradle sync to complete

3. **Configure API Endpoint**
   - Edit `app/src/main/kotlin/com/muulroute/driver/data/api/ApiService.kt`
   - Update `BASE_URL` constant with your backend API URL

4. **Build APK**
   ```bash
   ./gradlew build
   ```

5. **Run on Emulator or Device**
   - Connect Android device via USB or open emulator
   - Click "Run" in Android Studio
   - Select target device

## Key Features

### 1. Authentication
- Email/Password login
- JWT token-based authentication
- Secure token storage

### 2. Dashboard
- View available deliveries
- Real-time delivery count
- Quick access to delivery management

### 3. Delivery Management
- Accept/Decline deliveries
- View pickup and delivery locations
- Navigation to delivery addresses

### 4. Location Tracking
- Real-time GPS location
- Google Play Services integration
- Background location updates

### 5. Maps Integration
- Mapbox for route visualization
- Real-time driver tracking
- Offline map support

## Configuration

### API Configuration
Update the API endpoint in `ApiService.kt`:
```kotlin
private const val BASE_URL = "https://your-api.com/api/"
```

### Android Manifest Permissions
The following permissions are included:
- `INTERNET` - API communication
- `ACCESS_FINE_LOCATION` - Precise GPS location
- `ACCESS_COARSE_LOCATION` - Approximate location
- `ACCESS_NETWORK_STATE` - Network detection
- `CHANGE_NETWORK_STATE` - Network management

## Dependencies

### Core Android Libraries
- `androidx.core:core-ktx` - Kotlin extensions
- `androidx.appcompat:appcompat` - Backward compatibility
- `androidx.activity:activity-ktx` - Activity lifecycle
- `androidx.fragment:fragment-ktx` - Fragment support

### Networking
- `retrofit2` - REST API client
- `okhttp3` - HTTP client
- `gson` - JSON serialization

### Location & Maps
- `com.google.android.gms:play-services-location` - Location services
- `com.mapbox.maps:android` - Mapbox maps

### Concurrency
- `kotlinx-coroutines-android` - Async operations
- `kotlinx-coroutines-core` - Coroutine core

### Dependency Injection
- `com.google.dagger:hilt-android` - DI framework

## Building for Release

1. **Generate Signed APK**
   - Build → Generate Signed Bundle/APK
   - Select "APK"
   - Create or select keystore
   - Choose release build variant

2. **ProGuard Obfuscation**
   - Enabled for release builds by default
   - Configure in `build.gradle`

3. **Testing**
   - Run unit tests: `./gradlew test`
   - Run instrumented tests: `./gradlew connectedAndroidTest`

## Environment Variables

Create `.env.local` file:
```
API_URL=https://your-api.com/api/
MAPBOX_API_KEY=your_mapbox_key
```

## Troubleshooting

### Build Issues
- Run `./gradlew clean` to clean build cache
- Invalidate caches in Android Studio
- Update Gradle plugin version in `build.gradle`

### Runtime Issues
- Check logcat for error messages
- Verify API endpoint is correct
- Ensure location permissions are granted
- Check internet connectivity

## Development Guidelines

### Code Style
- Follow Kotlin conventions
- Use meaningful variable names
- Add comments for complex logic

### Testing
- Write unit tests for business logic
- Write instrumented tests for UI
- Test on multiple Android versions

### Performance
- Minimize network calls
- Use coroutines for async operations
- Cache location data locally

## Future Enhancements

- [ ] Real-time delivery tracking with WebSocket
- [ ] Offline delivery acceptance
- [ ] Photo capture for delivery proof
- [ ] Customer notifications
- [ ] Route optimization
- [ ] Analytics dashboard
- [ ] Multi-language support

## License

This project is part of MuulRoute platform.

## Support

For issues and support, contact the development team or create an issue in the project repository.
