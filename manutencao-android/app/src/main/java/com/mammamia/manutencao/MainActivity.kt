package com.mammamia.manutencao

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import java.io.File

// Link do menu do Web App (mesmo que abre no navegador — o app é só uma
// moldura em volta dele, toda a lógica continua no Apps Script).
private const val URL_APP =
    "https://script.google.com/macros/s/AKfycbxN_cFnGJpZgwVaCAegqB0HwrBsw_wKQd56wXyeq3RK5LZbumHrFaudxu9VjQMPBuOauQ/exec"

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    // Guardam o estado de um pedido de foto em andamento (o campo de foto
    // das telas de abrir/fechar OS), entre o momento em que a página pede
    // e o momento em que o usuário volta da câmera/galeria.
    private var fotoUploadCallback: ValueCallback<Array<Uri>>? = null
    private var caminhoFotoCamera: Uri? = null

    private val seletorArquivoLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { resultado ->
        val callback = fotoUploadCallback
        fotoUploadCallback = null
        if (callback == null) return@registerForActivityResult

        if (resultado.resultCode != RESULT_OK) {
            callback.onReceiveValue(null)
            return@registerForActivityResult
        }

        val dados = resultado.data
        val uris: Array<Uri>? = when {
            // Escolheu da galeria (pode vir mais de um arquivo selecionado).
            dados?.clipData != null -> {
                val clip = dados.clipData!!
                Array(clip.itemCount) { i -> clip.getItemAt(i).uri }
            }
            dados?.data != null -> arrayOf(dados.data!!)
            // Tirou foto pela câmera — o resultado vem no arquivo que a
            // gente mesmo preparou antes de abrir a câmera.
            caminhoFotoCamera != null -> arrayOf(caminhoFotoCamera!!)
            else -> null
        }
        callback.onReceiveValue(uris)
    }

    private val pedirPermissaoCamera = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* concedida ou não, o seletor de arquivo se ajusta sozinho depois */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED
        ) {
            pedirPermissaoCamera.launch(Manifest.permission.CAMERA)
        }

        webView = findViewById(R.id.webview)
        configurarWebView()
        webView.loadUrl(URL_APP)

        onBackPressedDispatcher.addCallback(this) {
            if (webView.canGoBack()) webView.goBack() else finish()
        }
    }

    private fun configurarWebView() {
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true

        // Mantém toda a navegação (menu, abrir OS, fechar OS) dentro do
        // próprio WebView — os links internos já são absolutos, então
        // funcionam exatamente como no navegador.
        webView.webViewClient = WebViewClient()

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                // Se já havia um pedido de foto pendente sem resposta,
                // cancela ele antes de começar um novo.
                fotoUploadCallback?.onReceiveValue(null)
                fotoUploadCallback = filePathCallback
                caminhoFotoCamera = null

                val intentsExtras = mutableListOf<Intent>()

                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA)
                    == PackageManager.PERMISSION_GRANTED
                ) {
                    val arquivoFoto = criarArquivoFotoTemporario()
                    if (arquivoFoto != null) {
                        caminhoFotoCamera = FileProvider.getUriForFile(
                            this@MainActivity,
                            "$packageName.fileprovider",
                            arquivoFoto
                        )
                        val intentCamera = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                            putExtra(MediaStore.EXTRA_OUTPUT, caminhoFotoCamera)
                        }
                        intentsExtras.add(intentCamera)
                    }
                }

                val intentGaleria = Intent(Intent.ACTION_GET_CONTENT).apply {
                    type = "image/*"
                    addCategory(Intent.CATEGORY_OPENABLE)
                }

                val intentEscolher = Intent.createChooser(intentGaleria, "Escolher foto")
                intentEscolher.putExtra(Intent.EXTRA_INITIAL_INTENTS, intentsExtras.toTypedArray())

                seletorArquivoLauncher.launch(intentEscolher)
                return true
            }
        }
    }

    /** Arquivo temporário onde a câmera do sistema grava a foto tirada. */
    private fun criarArquivoFotoTemporario(): File? {
        return try {
            val pasta = getExternalFilesDir(Environment.DIRECTORY_PICTURES) ?: return null
            File.createTempFile("foto_", ".jpg", pasta)
        } catch (erro: Exception) {
            null
        }
    }
}
