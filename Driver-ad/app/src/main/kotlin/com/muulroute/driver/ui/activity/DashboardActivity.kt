package com.muulroute.driver.ui.activity

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.muulroute.driver.databinding.ActivityDashboardBinding
import com.muulroute.driver.data.api.ApiService
import kotlinx.coroutines.launch

class DashboardActivity : AppCompatActivity() {

    private lateinit var binding: ActivityDashboardBinding
    private lateinit var apiService: ApiService

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityDashboardBinding.inflate(layoutInflater)
        setContentView(binding.root)

        apiService = ApiService.create()

        setupUI()
        loadDeliveries()
    }

    private fun setupUI() {
        binding.acceptDeliveryButton.setOnClickListener {
            navigateToDeliveryDetail()
        }

        binding.logoutButton.setOnClickListener {
            logout()
        }
    }

    private fun loadDeliveries() {
        lifecycleScope.launch {
            try {
                // TODO: Fetch deliveries from API
                binding.deliveryCountTextView.text = "0 Deliveries"
            } catch (e: Exception) {
                binding.deliveryCountTextView.text = "Error loading deliveries"
            }
        }
    }

    private fun navigateToDeliveryDetail() {
        val intent = Intent(this, DeliveryDetailActivity::class.java)
        startActivity(intent)
    }

    private fun logout() {
        // TODO: Clear stored token
        val intent = Intent(this, LoginActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
        startActivity(intent)
        finish()
    }
}
