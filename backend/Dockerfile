FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app
COPY . .
RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/* \
    && groupadd -r gitscope && useradd -r -g gitscope -m -d /home/gitscope gitscope \
    && mkdir -p /app/tmp/repos \
    && chown -R gitscope:gitscope /app

USER gitscope

COPY --from=build --chown=gitscope:gitscope /app/target/*.jar app.jar

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD bash -c 'echo > /dev/tcp/localhost/8080 || exit 1'

ENTRYPOINT ["java", "-Xmx256m", "-jar", "app.jar"]
