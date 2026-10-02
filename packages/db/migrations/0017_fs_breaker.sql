CREATE TABLE "fs_breaker" (
	"environment" varchar(16) PRIMARY KEY NOT NULL,
	"paused_at" timestamp with time zone DEFAULT now() NOT NULL,
	"probe_at" timestamp with time zone NOT NULL,
	"invalid_count" integer NOT NULL,
	"account_count" integer NOT NULL
);
