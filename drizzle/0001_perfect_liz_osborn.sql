CREATE TABLE "dexcom_oauth_credentials" (
	"connection_id" uuid PRIMARY KEY NOT NULL,
	"access_token_ciphertext" text NOT NULL,
	"refresh_token_ciphertext" text NOT NULL,
	"access_token_expires_at" timestamp with time zone NOT NULL,
	"scopes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dexcom_oauth_credentials" ADD CONSTRAINT "dexcom_oauth_credentials_connection_id_dexcom_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."dexcom_connections"("id") ON DELETE cascade ON UPDATE no action;