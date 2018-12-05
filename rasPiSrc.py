    #!/usr/bin/pythonScriptClient
    # -*- coding: utf-8 -*-

    from __future__ import division
    import requests
    import time
    import RPi.GPIO as GPIO
    import SimpleMFRC522
    import Adafruit_PCA9685
    import json

    pwm = Adafruit_PCA9685.PCA9685()

    tagPrevStatus = False
    tagCurStatus = False

    # Configure min and max servo pulse lengths
    servo_min = 150  # Min pulse length out of 4096
    servo_max = 600  # Max pulse length out of 4096

    def readTag():

        reader = SimpleMFRC522.SimpleMFRC522()

        try:
            id, text = reader.read()
            print(id)
            print(text)
        finally:
            GPIO.cleanup()

        return id

    def servoBeerPour():
        pwm.set_pwm(0, 0, servo_min)
        time.sleep(1)
        pwm.set_pwm(0, 0, servo_max)

    def servoCoffeePour():
        pwm.set_pwm(1, 0, servo_max)
        time.sleep(1)
        pwm.set_pwm(1, 0, servo_min)

    def main():

        products = {"001":"servoCh0", "002":"servoCh1"}
        
        while True:

            print("Waiting for a tag to read")
            
            tic = time.clock()
            payload = readTag()
            toc = time.clock()
            print(toc-tic)
            timeMeas = toc-tic

            if timeMeas > 0.1:

                print("Sending request")
                data = json.dumps({'tag_number':str(payload), "products":products })
                print(data)
                headers = {
                            'Content-Type': "application/json"
                        }

                r = requests.request("POST", 'https://ahfi1we718.execute-api.eu-central-1.amazonaws.com/dev/device/pay',
                         data=data, headers=headers)
                
                print(r.text) 

                if r.status_code == 200:
                    if r.json().get("servo") == "servoCh0":
                        servoBeerPour()
                        print("Pouring beer")
                    else:
                        servoCoffeePour()
                        print("Pouring coffee")
                    time.sleep(1)
                elif r.status_code == 911:
                    print("Not enough money")
                elif r.status_code == 922:
                    print("Not registered tag")
                elif r.status_code == 999:
                    print("Something weird happens")
                else:
                    print("Error!")
            else:
                print("tag is still there")

    if __name__ == '__main__':
        main()