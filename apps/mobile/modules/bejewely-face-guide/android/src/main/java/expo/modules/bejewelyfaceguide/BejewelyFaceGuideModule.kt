package expo.modules.bejewelyfaceguide

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetector
import com.google.mlkit.vision.face.FaceDetectorOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class BejewelyFaceGuideModule : Module() {
  private var detector: FaceDetector? = null

  private fun getDetector(): FaceDetector {
    val current = detector
    if (current != null) {
      return current
    }

    val options = FaceDetectorOptions.Builder()
      .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
      .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_NONE)
      .setContourMode(FaceDetectorOptions.CONTOUR_MODE_NONE)
      .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_NONE)
      .setMinFaceSize(0.15f)
      .build()

    return FaceDetection.getClient(options).also { detector = it }
  }

  private fun serializeFace(face: Face): Map<String, Any?> {
    val bounds = face.boundingBox
    return mapOf(
      "boundingBox" to mapOf(
        "left" to bounds.left.toDouble(),
        "top" to bounds.top.toDouble(),
        "right" to bounds.right.toDouble(),
        "bottom" to bounds.bottom.toDouble()
      ),
      "headEulerAngleX" to face.headEulerAngleX.toDouble(),
      "headEulerAngleY" to face.headEulerAngleY.toDouble(),
      "headEulerAngleZ" to face.headEulerAngleZ.toDouble()
    )
  }

  private fun deleteLocalFile(uri: Uri) {
    if (uri.scheme == "file") {
      uri.path?.let { path -> runCatching { File(path).delete() } }
    }
  }

  override fun definition() = ModuleDefinition {
    Name("BejewelyFaceGuide")

    AsyncFunction("detectFacesAsync") { uriValue: String, deleteAfterRead: Boolean, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("ERR_FACE_GUIDE_CONTEXT", "Android application context is unavailable.", null)
        return@AsyncFunction
      }

      val uri = Uri.parse(uriValue)
      val image = try {
        InputImage.fromFilePath(context, uri)
      } catch (error: Throwable) {
        if (deleteAfterRead) {
          deleteLocalFile(uri)
        }
        promise.reject("ERR_FACE_GUIDE_IMAGE", "The guidance image could not be opened.", error)
        return@AsyncFunction
      }

      getDetector().process(image)
        .addOnSuccessListener { faces ->
          if (deleteAfterRead) {
            deleteLocalFile(uri)
          }
          promise.resolve(
            mapOf(
              "faces" to faces.map(::serializeFace)
            )
          )
        }
        .addOnFailureListener { error ->
          if (deleteAfterRead) {
            deleteLocalFile(uri)
          }
          promise.reject("ERR_FACE_GUIDE_DETECTION", "Native face guidance failed.", error)
        }
    }

    OnDestroy {
      detector?.close()
      detector = null
    }
  }
}
