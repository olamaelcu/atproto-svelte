/// <reference types="@sveltejs/kit" />

declare global {
	namespace App {
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
		interface Locals {
			// Define your locals here
		}
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
		interface PageData {
			// Define your page data here
		}
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
		interface Platform {
			// Define your platform here
		}
	}
}

export {};