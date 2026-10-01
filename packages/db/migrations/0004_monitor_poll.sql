CREATE TABLE "fs_probes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fs_probes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"environment" varchar(16) NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" varchar(8) NOT NULL,
	"latency_ms" integer,
	"http_status" smallint,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "poll_votes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "poll_votes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"poll" varchar(32) NOT NULL,
	"choice" varchar(16) NOT NULL,
	"voter_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "fs_probes_env_time" ON "fs_probes" USING btree ("environment","checked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "poll_votes_uq" ON "poll_votes" USING btree ("poll","voter_hash");--> statement-breakpoint
CREATE INDEX "poll_votes_poll_choice" ON "poll_votes" USING btree ("poll","choice");