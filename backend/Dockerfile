# ─── Runtime-only stage (JAR pre-built locally) ───────────────────────────────
FROM eclipse-temurin:21-jre AS runtime

WORKDIR /app

# Install git for repository cloning and setup non-root user
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/* \
    && groupadd -r gitscope && useradd -r -g gitscope -m -d /home/gitscope gitscope \
    && mkdir -p /app/tmp/repos \
    && chown -R gitscope:gitscope /app

USER gitscope

# Copy the pre-built jar
COPY --chown=gitscope:gitscope target/gitscope-backend-1.0.0.jar app.jar

# Expose the Spring Boot port
EXPOSE 8080

# Health check — check port 8080 is listening (actuator not included)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD bash -c 'echo > /dev/tcp/localhost/8080 || exit 1'

# Run the application
ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-jar", "app.jar"]
