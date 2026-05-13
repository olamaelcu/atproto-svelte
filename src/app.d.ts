/// <reference types="@sveltejs/kit" />

declare global {
	namespace App {
		interface Locals {
			// Define your locals here
		}
		interface PageData {
			// Define your page data here
		}
		interface Platform {
			// Define your platform here
		}
	}
}

export {};