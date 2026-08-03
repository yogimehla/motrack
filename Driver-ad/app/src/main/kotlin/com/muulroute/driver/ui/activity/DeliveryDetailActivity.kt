package com.muulroute.driver.ui.activity

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.muulroute.driver.databinding.ActivityDeliveryDetailBinding

class DeliveryDetailActivity : AppCompatActivity() {

    private lateinit var binding: ActivityDeliveryDetailBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityDeliveryDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupUI()
    }

    private fun setupUI() {
        binding.backButton.setOnClickListener {
            finish()
        }

        binding.acceptDeliveryButton.setOnClickListener {
            acceptDelivery()
        }

        binding.declineDeliveryButton.setOnClickListener {
            declineDelivery()
        }
    }

    private fun acceptDelivery() {
        // TODO: Call API to accept delivery
        finish()
    }

    private fun declineDelivery() {
        // TODO: Call API to decline delivery
        finish()
    }
}
