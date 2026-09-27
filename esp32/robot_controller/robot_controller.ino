/*
  Robot motor controller for the Robot Station web app.

  Receives one command per line over USB serial (115200 baud):
    F <speed>   forward   (speed 0-255, optional, default 200)
    B <speed>   backward
    L <speed>   turn left  (spin in place)
    R <speed>   turn right (spin in place)
    S           stop

  Safety: while moving, the web app repeats the command every 150 ms.
  If nothing arrives for 500 ms, the motors stop on their own.

  Wiring (L298N or similar dual H-bridge driver):
    Left motor : ENA -> GPIO 14 (PWM), IN1 -> GPIO 27, IN2 -> GPIO 26
    Right motor: ENB -> GPIO 32 (PWM), IN3 -> GPIO 25, IN4 -> GPIO 33
    Driver GND must be connected to ESP32 GND.
  Remove the ENA/ENB jumpers on the L298N so speed control works.

  With no motors wired, the on-board LED (GPIO 2) lights while moving,
  so you can test the whole chain on a bare ESP32.
*/

#include <Arduino.h>

// ---- Pins (change to match your wiring) ----
const int ENA = 14, IN1 = 27, IN2 = 26;   // left motor
const int ENB = 32, IN3 = 25, IN4 = 33;   // right motor
const int LED = 2;

// Flip if a motor spins the wrong way
const bool INVERT_LEFT = false;
const bool INVERT_RIGHT = false;

const unsigned long TIMEOUT_MS = 500;
const int DEFAULT_SPEED = 200;

char current = 'S';
unsigned long lastCommandAt = 0;
String line;

// speed: -255..255 (negative = reverse)
void setMotor(int en, int inA, int inB, int speed, bool invert) {
  if (invert) speed = -speed;
  if (speed > 0) {
    digitalWrite(inA, HIGH);
    digitalWrite(inB, LOW);
  } else if (speed < 0) {
    digitalWrite(inA, LOW);
    digitalWrite(inB, HIGH);
  } else {
    digitalWrite(inA, LOW);
    digitalWrite(inB, LOW);
  }
  analogWrite(en, abs(speed));
}

void drive(int left, int right) {
  setMotor(ENA, IN1, IN2, left, INVERT_LEFT);
  setMotor(ENB, IN3, IN4, right, INVERT_RIGHT);
  digitalWrite(LED, (left || right) ? HIGH : LOW);
}

void apply(char cmd, int speed) {
  switch (cmd) {
    case 'F': drive(speed, speed); break;
    case 'B': drive(-speed, -speed); break;
    case 'L': drive(-speed, speed); break;
    case 'R': drive(speed, -speed); break;
    default:  drive(0, 0); cmd = 'S'; break;
  }
  // Report only changes so the log is not flooded by the 150 ms repeats
  if (cmd != current) {
    current = cmd;
    Serial.print("OK ");
    Serial.print(cmd);
    if (cmd != 'S') { Serial.print(' '); Serial.print(speed); }
    Serial.println();
  }
}

void handleLine(String s) {
  s.trim();
  if (s.length() == 0) return;
  char cmd = toupper(s.charAt(0));
  int speed = DEFAULT_SPEED;
  if (s.length() > 2) speed = constrain(s.substring(2).toInt(), 0, 255);

  if (cmd == 'F' || cmd == 'B' || cmd == 'L' || cmd == 'R' || cmd == 'S') {
    lastCommandAt = millis();
    apply(cmd, speed);
  } else {
    Serial.print("ERR unknown command: ");
    Serial.println(s);
  }
}

void setup() {
  Serial.begin(115200);
  int outputs[] = {ENA, IN1, IN2, ENB, IN3, IN4, LED};
  for (int p : outputs) pinMode(p, OUTPUT);
  drive(0, 0);
  line.reserve(32);
  Serial.println("READY robot_controller");
}

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      handleLine(line);
      line = "";
    } else if (line.length() < 31) {
      line += c;
    }
  }

  if (current != 'S' && millis() - lastCommandAt > TIMEOUT_MS) {
    apply('S', 0);
    Serial.println("TIMEOUT motors stopped");
  }
}
