"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { WatchtowerScene } from "./watchtower-scene"

const INITIAL_LINES = [
  "WATCHTOWER COMMAND SYSTEM v1.0",
  "================================",
  "",
  "> ENTER FIREFIGHTING DOCTRINE",
  "",
  "Your strategy will be injected into the orchestrator agent.",
  "It will use this doctrine to make all in-game decisions.",
  "The agent acts alone. You will not intervene.",
  "",
  "Examples of effective doctrines:",
  "- Prioritize village protection above all else",
  "- Use helicopters for direct suppression, ground crews for firebreaks",
  "- Establish firebreaks at natural barriers (rivers, roads)",
  "- Attack fire from downwind to prevent spread acceleration",
  "",
  "Type your doctrine below. Press ENTER twice to deploy.",
  "",
  "DOCTRINE >",
]

const DEPLOY_SEQUENCE = [
  "",
  "Initializing orchestrator...",
  "Fetching wind conditions... [London, 12mph NE]",
  "Spawning sub-agents... [3x HELICOPTER] [4x GROUND CREW]",
  "Injecting doctrine into command layer...",
  "Fire ignition point set.",
  "",
  "Stand by.",
  "",
  "DEPLOYING...",
]

export function DoctrineTerminal() {
  const router = useRouter()
  const [lines, setLines] = useState<string[]>(INITIAL_LINES)
  const [currentInput, setCurrentInput] = useState("")
  const [doctrineLines, setDoctrineLines] = useState<string[]>([])
  const [isDeploying, setIsDeploying] = useState(false)
  const [cursorVisible, setCursorVisible] = useState(true)
  const [deployIndex, setDeployIndex] = useState(0)
  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Blinking cursor
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible((v) => !v)
    }, 530)
    return () => clearInterval(interval)
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [lines])

  // Focus input on mount and click
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleTerminalClick = () => {
    inputRef.current?.focus()
  }

  // Deploy sequence animation
  useEffect(() => {
    if (isDeploying && deployIndex < DEPLOY_SEQUENCE.length) {
      const timeout = setTimeout(() => {
        setLines((prev) => [...prev, DEPLOY_SEQUENCE[deployIndex]])
        setDeployIndex((i) => i + 1)
      }, 300 + Math.random() * 400)
      return () => clearTimeout(timeout)
    } else if (isDeploying && deployIndex >= DEPLOY_SEQUENCE.length) {
      // Navigate to game after deploy sequence
      const timeout = setTimeout(() => {
        // Store doctrine in sessionStorage for the game to use
        sessionStorage.setItem("watchtower-doctrine", doctrineLines.join("\n"))
        router.push("/game")
      }, 1500)
      return () => clearTimeout(timeout)
    }
  }, [isDeploying, deployIndex, router, doctrineLines])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (isDeploying) return

      if (e.key === "Enter") {
        e.preventDefault()
        
        if (currentInput.trim() === "") {
          // Empty enter - check if we should deploy
          if (doctrineLines.length > 0) {
            // Double enter - deploy
            setIsDeploying(true)
            setLines((prev) => [...prev, "", "> DEPLOY"])
          }
        } else {
          // Add line to doctrine
          setDoctrineLines((prev) => [...prev, currentInput])
          setLines((prev) => [...prev, currentInput])
          setCurrentInput("")
        }
      } else if (e.key === "Backspace" && currentInput === "" && doctrineLines.length > 0) {
        // Allow deleting previous doctrine line
        e.preventDefault()
        const lastLine = doctrineLines[doctrineLines.length - 1]
        setDoctrineLines((prev) => prev.slice(0, -1))
        setLines((prev) => prev.slice(0, -1))
        setCurrentInput(lastLine)
      }
    },
    [currentInput, doctrineLines, isDeploying]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isDeploying) return
    setCurrentInput(e.target.value.replace(/\n/g, ""))
  }

  return (
    <div 
      className="relative min-h-screen cursor-text font-mono overflow-hidden"
      onClick={handleTerminalClick}
    >
      {/* Blurred watchtower scene background */}
      <div className="absolute inset-0 z-0 blur-md scale-105 opacity-40">
        <WatchtowerScene hideUI />
      </div>

      {/* Dark overlay */}
      <div className="absolute inset-0 z-10 bg-black/75" />

      {/* Terminal content layer */}
      <div className="relative z-20 p-4 md:p-8">
      
      {/* CRT scan line effect */}
      <div 
        className="pointer-events-none fixed inset-0 z-50"
        style={{
          background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 1px, transparent 1px, transparent 2px)",
        }}
      />
      
      {/* CRT glow effect */}
      <div 
        className="pointer-events-none fixed inset-0 z-40"
        style={{
          boxShadow: "inset 0 0 150px rgba(255, 176, 50, 0.03)",
        }}
      />

      {/* Terminal container */}
      <div 
        ref={terminalRef}
        className="mx-auto max-w-4xl h-[calc(100vh-4rem)] overflow-y-auto scrollbar-hide"
        style={{
          textShadow: "0 0 8px rgba(255, 176, 50, 0.5)",
        }}
      >
        {/* Header */}
        <div className="mb-6 flex items-center gap-2 text-amber-500/60 text-xs">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500/60 animate-pulse" />
          <span>SECURE TERMINAL</span>
          <span className="ml-auto">SESSION: {Math.random().toString(36).substring(2, 8).toUpperCase()}</span>
        </div>

        {/* Terminal output */}
        <div className="space-y-0">
          {lines.map((line, i) => (
            <div 
              key={i} 
              className={`text-amber-500 leading-relaxed whitespace-pre-wrap ${
                line.startsWith(">") ? "text-amber-400 font-bold" : ""
              } ${
                line.startsWith("WATCHTOWER") ? "text-amber-300 text-lg" : ""
              } ${
                line.startsWith("===") ? "text-amber-600" : ""
              } ${
                line.startsWith("Initializing") || 
                line.startsWith("Fetching") || 
                line.startsWith("Spawning") ||
                line.startsWith("Injecting") ||
                line.startsWith("Fire ignition") ||
                line.startsWith("DEPLOYING")
                  ? "text-green-500" 
                  : ""
              }`}
            >
              {line}
            </div>
          ))}
        </div>

        {/* Current input line */}
        {!isDeploying && (
          <div className="flex text-amber-500 mt-0">
            <span className="whitespace-pre-wrap">{currentInput}</span>
            <span 
              className={`inline-block w-2 h-5 bg-amber-500 ml-0.5 ${
                cursorVisible ? "opacity-100" : "opacity-0"
              }`}
            />
          </div>
        )}

        {/* Hidden textarea for input */}
        <textarea
          ref={inputRef}
          value={currentInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="absolute opacity-0 pointer-events-none"
          autoFocus
          disabled={isDeploying}
        />

        {/* Bottom padding for scroll */}
        <div className="h-20" />
      </div>

      {/* Doctrine status */}
      <div className="fixed bottom-4 right-4 text-amber-500/40 text-sm z-30">
        {isDeploying ? (
          <span className="text-green-500 animate-pulse">DEPLOYING AGENT...</span>
        ) : doctrineLines.length > 0 ? (
          <span>{doctrineLines.length} lines | ENTER to add, ENTER twice to deploy</span>
        ) : (
          <span>Awaiting doctrine input...</span>
        )}
      </div>

      {/* Back link */}
      <button
        onClick={() => router.push("/")}
        className="fixed bottom-4 left-4 text-amber-500/40 hover:text-amber-500/80 text-sm transition-colors z-30"
      >
        {"<"} ABORT
      </button>

      </div>{/* Close terminal content layer */}

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}
