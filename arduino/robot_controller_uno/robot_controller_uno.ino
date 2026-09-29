/*
  Robot motor controller for the Robot Station web app, Arduino Uno version.
  Same commands as the ESP32 sketch, so the web app works unchanged.

  Receives one command per line over USB serial (115200 baud):
    F <speed>   forward   (speed 0-255, optional, default 200)
    B <speed>   backward
    L <speed>   turn left  (spin in place)
    R <speed>   turn right (spin in place)
    S           stop
    ?           replies "READY robot_controller" (the web app checks this)

  Safety: while moving, the web app repeats the command every 150 ms.
  If nothing arrives for 500 ms, the motors stop on their own.

  Wiring (L298N or similar dual H-bridge driver):
    Left motor : ENA -> pin 5 (PWM), IN1 -> pin 7,  IN2 -> pin 8
    Right motor: ENB -> pin 6 (PWM), IN3 -> pin 11, IN4 -> pin 12
    Driver GND must be connected to Arduino GND.
  Remove the ENA/ENB jumpers on the L298N so speed control works.
  ENA/ENB must be on PWM pins (marked ~ on the board: 3, 5, 6, 9, 10, 11).

  With no motors wired, the on-board LED (pin 13, "L") lights while moving,
  so you can test the whole chain on a bare Uno.

  Note: the Uno restarts when the web app opens its port. It answers about
  2 seconds later; the web app waits for that.
*/

// ---- Pins (change to match your wiring) ----
const int ENA = 5, IN1 = 7, IN2 = 8;     // left motor
const int ENB = 6, IN3 = 11, IN4 = 12;   // right motor
const int LED = LED_BUILTIN;             // pin 13

// Flip if a motor spins the wrong way
const bool INVERT_LEFT = false;
const bool INVERT_RIGHT = false;

const unsigned long TIMEOUT_MS = 500;
const int DEFAULT_SPEED = 200;

char current = 'S';
unsigned long lastCommandAt = 0;
char line[32];
byte lineLen = 0;

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
    Serial.print(F("OK "));
    Serial.print(cmd);
    if (cmd != 'S') { Serial.print(' '); Serial.print(speed); }
    Serial.println();
  }
}

// Fixed buffer instead of String: the Uno has only 2 KB of RAM
void handleLine(char *s) {
  while (*s == ' ') s++;
  if (*s == '\0') return;
  char cmd = toupper(*s);
  if (cmd == '?') {
    Serial.println(F("READY robot_controller"));
    return;
  }
  // Speed after the letter, with or without a space: "F 200" or "F200"
  int speed = DEFAULT_SPEED;
  char *num = s + 1;
  while (*num == ' ') num++;
  if (*num) speed = constrain(atoi(num), 0, 255);

  if (cmd == 'F' || cmd == 'B' || cmd == 'L' || cmd == 'R' || cmd == 'S') {
    lastCommandAt = millis();
    apply(cmd, speed);
  } else {
    Serial.print(F("ERR unknown command: "));
    Serial.println(s);
  }
}

void setup() {
  Serial.begin(115200);
  int outputs[] = {ENA, IN1, IN2, ENB, IN3, IN4, LED};
  for (int p : outputs) pinMode(p, OUTPUT);
  drive(0, 0);
  Serial.println(F("READY robot_controller"));
}

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      line[lineLen] = '\0';
      handleLine(line);
      lineLen = 0;
    } else if (lineLen < sizeof(line) - 1) {
      line[lineLen++] = c;
    }
  }

  if (current != 'S' && millis() - lastCommandAt > TIMEOUT_MS) {
    apply('S', 0);
    Serial.println(F("TIMEOUT motors stopped"));
  }
}
