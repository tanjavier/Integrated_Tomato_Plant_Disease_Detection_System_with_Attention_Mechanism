import os
from flask import Flask, render_template, request, jsonify
import tensorflow as tf
import numpy as np
from PIL import Image
import io
import base64
import matplotlib.pyplot as plt
import matplotlib.cm as cm

app = Flask(__name__)

# Load the model
model = tf.keras.models.load_model('model.h5')

# Define the classes
classes = ['Bacterial Spot', 'Early Blight', 'Late Blight', 'Leaf Mold', 'Septoria Leaf Spot', 
           'Spider Mites', 'Target Spot', 'Yellow Leaf Curl Virus', 'Mosaic Virus', 'Healthy']

def get_img_array(img_data, size):
    img = Image.open(io.BytesIO(img_data))
    img = img.convert('RGB')  # Ensure image is in RGB format
    img = img.resize(size)
    array = tf.keras.preprocessing.image.img_to_array(img)
    array = np.expand_dims(array, axis=0)
    return array

def preprocess_image(image):
    img_array = get_img_array(image, size=(224, 224))
    return img_array

def make_gradcam_heatmap(img_array, model, last_conv_layer_name, pred_index=None):
    grad_model = tf.keras.models.Model(
        [model.inputs], [model.get_layer(last_conv_layer_name).output, model.output]
    )

    with tf.GradientTape() as tape:
        last_conv_layer_output, preds = grad_model(img_array)
        if pred_index is None:
            pred_index = tf.argmax(preds[0])
        class_channel = preds[:, pred_index]

    grads = tape.gradient(class_channel, last_conv_layer_output)
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
    last_conv_layer_output = last_conv_layer_output[0]
    heatmap = last_conv_layer_output @ pooled_grads[..., tf.newaxis]
    heatmap = tf.squeeze(heatmap)
    heatmap = tf.maximum(heatmap, 0) / tf.math.reduce_max(heatmap)
    return heatmap.numpy()

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/detect', methods=['GET', 'POST'])
def detect():
    if request.method == 'POST':
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'})
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'})
        if file:
            # Check file extension
            if not file.filename.lower().endswith('.jpg') and not file.filename.lower().endswith('.jpeg'):
                return jsonify({'error': 'Only JPEG images are allowed'})
            
            image_data = file.read()
            img_array = preprocess_image(image_data)
            
            # Make prediction
            prediction = model.predict(img_array)
            predicted_class_index = np.argmax(prediction[0])
            predicted_class = classes[predicted_class_index]
            confidence = float(np.max(prediction[0]))
            
            # Check confidence threshold
            if confidence < 0.8:
                return jsonify({'error': 'Unable to confidently detect a tomato plant disease in this image'})
            
            # Generate Grad-CAM
            last_conv_layer = next(layer for layer in reversed(model.layers) if isinstance(layer, tf.keras.layers.Conv2D))
            heatmap = make_gradcam_heatmap(img_array, model, last_conv_layer.name, pred_index=predicted_class_index)
            
            # Create Grad-CAM image
            img = Image.open(io.BytesIO(image_data))
            img = img.convert('RGB')
            img = img.resize((224, 224))
            heatmap = np.uint8(255 * heatmap)
            jet = cm.get_cmap("jet")
            jet_colors = jet(np.arange(256))[:, :3]
            jet_heatmap = jet_colors[heatmap]
            jet_heatmap = Image.fromarray(np.uint8(jet_heatmap*255))
            jet_heatmap = jet_heatmap.resize(img.size)
            superimposed_img = Image.blend(img, jet_heatmap, 0.4)
            
            # Save images to base64
            buffered = io.BytesIO()
            img.save(buffered, format="JPEG")
            img_str = base64.b64encode(buffered.getvalue()).decode()
            
            buffered = io.BytesIO()
            superimposed_img.save(buffered, format="JPEG")
            gradcam_str = base64.b64encode(buffered.getvalue()).decode()
            
            # Prepare results
            results = {
                'class': predicted_class,
                'confidence': confidence,
                'all_probabilities': prediction[0].tolist(),
                'original_image': img_str,
                'gradcam_image': gradcam_str
            }
            return jsonify(results)
    return render_template('detect.html')

@app.route('/about')
def about():
    return render_template('about.html')

if __name__ == '__main__':
    app.run(debug=True)