package com.example.Robot_Backend.Controllers;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.core.io.FileSystemResource;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.File;
import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/scripts")
public class RobotScriptController {

    @Value("${python.service.url:http://localhost:8081/generate-script-from-file}")
    private String pythonServiceUrl;

    @PostMapping("/generate")
    public ResponseEntity<String> generateScript(
            @RequestParam("file") MultipartFile file,
            @RequestParam("language") String language,
            @RequestParam(value = "originalFileName", required = false) String originalFileName
    ) throws IOException {

        File tempFile = File.createTempFile("input-", ".json");
        try {
            file.transferTo(tempFile);

            org.springframework.util.MultiValueMap<String, Object> body = new org.springframework.util.LinkedMultiValueMap<>();
            body.add("file", new FileSystemResource(tempFile));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            HttpEntity<org.springframework.util.MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            String urlWithLang = pythonServiceUrl + "?language=" + language;

            RestTemplate restTemplate = new RestTemplate();
            try {
                ResponseEntity<String> response = restTemplate.exchange(
                        urlWithLang,
                        HttpMethod.POST,
                        requestEntity,
                        String.class
                );
                return ResponseEntity.ok()
                        .contentType(MediaType.TEXT_PLAIN)
                        .body(response.getBody());
            } catch (org.springframework.web.client.HttpClientErrorException ex) {
                String pythonError = ex.getResponseBodyAsString();
                String message = "Unknown error";
                try {
                    ObjectMapper objectMapper = new ObjectMapper();
                    Map<String, Object> errorMap = objectMapper.readValue(pythonError, Map.class);
                    if (errorMap.containsKey("detail")) {
                        message = errorMap.get("detail").toString();
                    } else if (errorMap.containsKey("message")) {
                        message = errorMap.get("message").toString();
                    } else {
                        message = pythonError;
                    }
                } catch (Exception e) {
                    message = pythonError;
                }
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .contentType(MediaType.TEXT_PLAIN)
                        .body(message);
            } catch (Exception ex) {
                // For any other errors (like connection refused), always return your custom message
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .contentType(MediaType.TEXT_PLAIN)
                        .body("an unexpected error happened");
            }
        } finally {
            tempFile.delete();
        }
    }
}