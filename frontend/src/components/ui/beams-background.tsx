"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface AnimatedGradientBackgroundProps {
    className?: string;
    children?: React.ReactNode;
    intensity?: "subtle" | "medium" | "strong";
}

interface Beam {
    x: number;
    y: number;
    width: number;
    length: number;
    angle: number;
    speed: number;
    opacity: number;
    hue: number;
    saturation: number;
    lightness: number;
    pulse: number;
    pulseSpeed: number;
}

const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");

function getGitHubColor(index: number) {
    const colors = [
        { hue: 212, saturation: 40, lightness: 35 },
        { hue: 142, saturation: 35, lightness: 30 },
        { hue: 262, saturation: 35, lightness: 35 },
        { hue: 215, saturation: 12, lightness: 25 },
    ];
    const color = colors[index % colors.length];
    return {
        hue: color.hue + (Math.random() - 0.5) * 8,
        saturation: color.saturation + (Math.random() - 0.5) * 5,
        lightness: color.lightness + (Math.random() - 0.5) * 5,
    };
}

function createBeam(width: number, height: number, index: number): Beam {
    const angle = -35 + Math.random() * 10;
    const color = getGitHubColor(index);
    return {
        x: Math.random() * width * 1.5 - width * 0.25,
        y: Math.random() * height * 1.5 - height * 0.25,
        width: 10 + Math.random() * 20,
        length: height * 2.5,
        angle: angle,
        speed: (0.3 + Math.random() * 0.5) / 4,
        opacity: 0.08 + Math.random() * 0.10,
        hue: color.hue,
        saturation: color.saturation,
        lightness: color.lightness,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.008 + Math.random() * 0.012,
    };
}

export function BeamsBackground({
    className,
    children,
    intensity = "subtle",
}: AnimatedGradientBackgroundProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const beamsRef = useRef<Beam[]>([]);
    const animationFrameRef = useRef<number>(0);
    const MINIMUM_BEAMS = 18;

    const opacityMap = {
        subtle: 0.5,
        medium: 0.75,
        strong: 1,
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const updateCanvasSize = () => {
            const scaleFactor = 4;
            const targetWidth = Math.ceil(window.innerWidth / scaleFactor);
            const targetHeight = Math.ceil(window.innerHeight / scaleFactor);

            canvas.width = targetWidth;
            canvas.height = targetHeight;
            canvas.style.width = `${window.innerWidth}px`;
            canvas.style.height = `${window.innerHeight}px`;

            const totalBeams = Math.floor(MINIMUM_BEAMS * 1.3);
            beamsRef.current = Array.from({ length: totalBeams }, (_, index) =>
                createBeam(canvas.width, canvas.height, index)
            );
        };

        updateCanvasSize();
        window.addEventListener("resize", updateCanvasSize);

        function resetBeam(beam: Beam, index: number) {
            if (!canvas) return beam;
            
            const column = index % 3;
            const spacing = canvas.width / 3;

            beam.y = canvas.height + 100;
            beam.x =
                column * spacing +
                spacing / 2 +
                (Math.random() - 0.5) * spacing * 0.5;
            beam.width = 20 + Math.random() * 20;
            beam.speed = (0.25 + Math.random() * 0.25) / 4;
            const color = getGitHubColor(index);
            beam.hue = color.hue;
            beam.saturation = color.saturation;
            beam.lightness = color.lightness;
            beam.opacity = 0.06 + Math.random() * 0.08;
            return beam;
        }

        function drawBeam(ctx: CanvasRenderingContext2D, beam: Beam) {
            ctx.save();
            ctx.translate(beam.x, beam.y);
            ctx.rotate((beam.angle * Math.PI) / 180);

            const pulsingOpacity =
                beam.opacity *
                (0.8 + Math.sin(beam.pulse) * 0.2) *
                opacityMap[intensity];

            const gradient = ctx.createLinearGradient(0, 0, 0, beam.length);

            gradient.addColorStop(0, `hsla(${beam.hue}, ${beam.saturation}%, ${beam.lightness}%, 0)`);
            gradient.addColorStop(
                0.1,
                `hsla(${beam.hue}, ${beam.saturation}%, ${beam.lightness}%, ${pulsingOpacity * 0.4})`
            );
            gradient.addColorStop(
                0.4,
                `hsla(${beam.hue}, ${beam.saturation}%, ${beam.lightness}%, ${pulsingOpacity})`
            );
            gradient.addColorStop(
                0.6,
                `hsla(${beam.hue}, ${beam.saturation}%, ${beam.lightness}%, ${pulsingOpacity})`
            );
            gradient.addColorStop(
                0.9,
                `hsla(${beam.hue}, ${beam.saturation}%, ${beam.lightness}%, ${pulsingOpacity * 0.4})`
            );
            gradient.addColorStop(1, `hsla(${beam.hue}, ${beam.saturation}%, ${beam.lightness}%, 0)`);

            ctx.fillStyle = gradient;
            ctx.fillRect(-beam.width / 2, 0, beam.width, beam.length);
            ctx.restore();
        }

        function animate() {
            if (!canvas || !ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            beamsRef.current.forEach((beam, index) => {
                beam.y -= beam.speed;
                beam.pulse += beam.pulseSpeed;

                if (beam.y + beam.length < -100) {
                    resetBeam(beam, index);
                }

                drawBeam(ctx, beam);
            });

            animationFrameRef.current = requestAnimationFrame(animate);
        }

        animate();

        return () => {
            window.removeEventListener("resize", updateCanvasSize);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [intensity]);

    return (
        <div
            className={cn(
                "relative h-screen w-full overflow-hidden bg-[#0d1117]",
                className
            )}
        >
            <canvas
                ref={canvasRef}
                className="absolute inset-0 pointer-events-none"
                style={{ filter: "blur(12px)" }}
            />

            <motion.div
                className="absolute inset-0 bg-[#0d1117]/5 pointer-events-none"
                animate={{
                    opacity: [0.03, 0.08, 0.03],
                }}
                transition={{
                    duration: 12,
                    ease: "easeInOut",
                    repeat: Number.POSITIVE_INFINITY,
                }}
            />

            <div className="relative z-10 w-full h-full flex flex-col">
                {children}
            </div>
        </div>
    );
}
