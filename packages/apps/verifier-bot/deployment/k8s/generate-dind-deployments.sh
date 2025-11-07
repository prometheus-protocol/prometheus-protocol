#!/bin/bash

# Generate deployments-prod-dind.yaml with Docker-in-Docker sidecar
# Reduced memory footprint for smaller nodes

cat > deployments-prod-dind.yaml << 'YAML_EOF'
# This deployment uses Docker-in-Docker (DinD) sidecar pattern
# Each pod runs both the verifier bot and a Docker daemon in separate containers
# Optimized for smaller nodes with limited memory
YAML_EOF

for i in {1..9}; do
  cat >> deployments-prod-dind.yaml << YAML_EOF
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: verifier-bot-$i
  namespace: prometheus-verifiers
  labels:
    app: verifier-bot
    instance: verifier-$i
spec:
  replicas: 1
  selector:
    matchLabels:
      app: verifier-bot
      instance: verifier-$i
  template:
    metadata:
      labels:
        app: verifier-bot
        instance: verifier-$i
    spec:
      containers:
        - name: verifier-bot
          image: ghcr.io/prometheus-protocol/verifier-bot:latest
          imagePullPolicy: Always
          env:
            - name: DOCKER_HOST
              value: tcp://localhost:2375
            - name: VERIFIER_API_KEY
              valueFrom:
                secretKeyRef:
                  name: verifier-api-keys
                  key: verifier-$i-api-key
            - name: IC_NETWORK
              valueFrom:
                configMapKeyRef:
                  name: verifier-config
                  key: IC_NETWORK
            - name: POLL_INTERVAL_MS
              valueFrom:
                configMapKeyRef:
                  name: verifier-config
                  key: POLL_INTERVAL_MS
            - name: BUILD_TIMEOUT_MS
              valueFrom:
                configMapKeyRef:
                  name: verifier-config
                  key: BUILD_TIMEOUT_MS
          resources:
            requests:
              memory: '512Mi'
              cpu: '250m'
            limits:
              memory: '1Gi'
              cpu: '1000m'
          volumeMounts:
            - name: canister-ids
              mountPath: /.dfx/local
              readOnly: true
        - name: dind
          image: docker:27-dind
          securityContext:
            privileged: true
          env:
            - name: DOCKER_TLS_CERTDIR
              value: ""
          resources:
            requests:
              memory: '256Mi'
              cpu: '100m'
            limits:
              memory: '512Mi'
              cpu: '500m'
          volumeMounts:
            - name: docker-storage
              mountPath: /var/lib/docker
      volumes:
        - name: docker-storage
          emptyDir: {}
        - name: canister-ids
          configMap:
            name: canister-ids
            items:
              - key: canister_ids.json
                path: canister_ids.json
      restartPolicy: Always
YAML_EOF
done

echo "Generated deployments-prod-dind.yaml with reduced memory footprint"
