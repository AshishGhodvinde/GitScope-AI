FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app
COPY . .
RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y git wget && rm -rf /var/lib/apt/lists/* \
    && groupadd -r gitscope && useradd -r -g gitscope -m -d /home/gitscope gitscope \
    && mkdir -p /app/tmp/repos /app/onnx \
    && wget -q https://github.com/spring-projects/spring-ai/raw/main/models/spring-ai-transformers/src/main/resources/onnx/all-MiniLM-L6-v2/model.onnx -O /app/onnx/model.onnx \
    && wget -q https://raw.githubusercontent.com/spring-projects/spring-ai/main/models/spring-ai-transformers/src/main/resources/onnx/all-MiniLM-L6-v2/tokenizer.json -O /app/onnx/tokenizer.json \
    && chown -R gitscope:gitscope /app

USER gitscope

COPY --from=build --chown=gitscope:gitscope /app/target/*.jar app.jar

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD bash -c 'echo > /dev/tcp/localhost/8080 || exit 1'

ENTRYPOINT ["java", "-Xmx260m", "-jar", "app.jar"]
