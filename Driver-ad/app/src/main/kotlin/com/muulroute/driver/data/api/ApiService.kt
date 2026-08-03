package com.muulroute.driver.data.api

import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import com.google.gson.annotations.SerializedName

interface ApiService {

    @POST("auth/login")
    suspend fun login(
        @Body request: LoginRequest
    ): Response<LoginResponse>

    @GET("deliveries")
    suspend fun getDeliveries(
        @Header("Authorization") token: String
    ): Response<DeliveriesResponse>

    @POST("deliveries/{id}/accept")
    suspend fun acceptDelivery(
        @Header("Authorization") token: String,
        @Body request: AcceptDeliveryRequest
    ): Response<BaseResponse>

    companion object {
        private const val BASE_URL = "http://your-api-url.com/api/"

        fun create(): ApiService {
            val retrofit = Retrofit.Builder()
                .baseUrl(BASE_URL)
                .addConverterFactory(GsonConverterFactory.create())
                .build()

            return retrofit.create(ApiService::class.java)
        }
    }
}

// Request/Response Data Classes
data class LoginRequest(
    val email: String,
    val password: String
)

data class LoginResponse(
    @SerializedName("success")
    val success: Boolean,
    @SerializedName("token")
    val token: String?,
    @SerializedName("driver")
    val driver: DriverData?,
    @SerializedName("message")
    val message: String?
)

data class DriverData(
    @SerializedName("id")
    val id: String,
    @SerializedName("name")
    val name: String,
    @SerializedName("email")
    val email: String,
    @SerializedName("phone")
    val phone: String?,
    @SerializedName("vehicle")
    val vehicle: String?
)

data class DeliveriesResponse(
    @SerializedName("success")
    val success: Boolean,
    @SerializedName("data")
    val data: List<DeliveryData>?
)

data class DeliveryData(
    @SerializedName("id")
    val id: String,
    @SerializedName("orderId")
    val orderId: String,
    @SerializedName("pickupLocation")
    val pickupLocation: Location,
    @SerializedName("deliveryLocation")
    val deliveryLocation: Location,
    @SerializedName("status")
    val status: String,
    @SerializedName("priority")
    val priority: String,
    @SerializedName("estimatedTime")
    val estimatedTime: Long?
)

data class Location(
    @SerializedName("latitude")
    val latitude: Double,
    @SerializedName("longitude")
    val longitude: Double,
    @SerializedName("address")
    val address: String
)

data class AcceptDeliveryRequest(
    val deliveryId: String
)

data class BaseResponse(
    @SerializedName("success")
    val success: Boolean,
    @SerializedName("message")
    val message: String?
)
