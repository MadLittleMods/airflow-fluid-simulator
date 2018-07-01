# Airflow fluid simulator

Quick and dirty project to create an airflow heat or fluid animation/diagram by painting/combing/dragging/raking a vector-field.

Based off of Dean Alex's JavaScript 2D Fluid / Turbulence Sim, http://neuroid.co.uk/lab/fluid/

Good for:

 - Airflow, wind (temperature/heat)
 - Water, fluid

If you want to use this, probably best to clone this locally and start adjusting the image and configuration there instead of using the live version.


## [Live demo](https://madlittlemods.github.io/airflow-fluid-simulator/)

See the live demo, https://madlittlemods.github.io/airflow-fluid-simulator/

Example:

![](https://i.imgur.com/LEhAWXy.gif)


## FAQ

### How do I adjust the background image/picture?

Search for `image.src` in `fluid.js`


### How do I adjust the vector field resolution?

Search for `new vectorField` in `fluid.js`


### How can I get a gif animation?

For a gif-animation, there are ways to save frames of a HTML `<canvas>` but it is easiest to use a desktop gif creator like [ShareX](https://getsharex.com/).

You can turn off the red vector-field with the checkbox in the controls section.
